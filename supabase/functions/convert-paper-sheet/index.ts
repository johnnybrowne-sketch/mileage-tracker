import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_SCAN_OUTPUT_TOKENS = 16000;
const PAGE_SCAN_CONCURRENCY = 3;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let uploadId = "";

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY");
    const model = Deno.env.get("ANTHROPIC_MODEL") || DEFAULT_MODEL;

    const body = await request.json();
    uploadId = String(body?.uploadId || "");

    if (!uploadId) {
      return jsonResponse({ error: "Upload id is required." }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: upload, error: uploadError } = await supabase
      .from("paper_sheet_uploads")
      .select("*")
      .eq("id", uploadId)
      .maybeSingle();

    if (uploadError) throw uploadError;
    if (!upload) {
      return jsonResponse({ error: "Paper sheet upload was not found." }, 404);
    }

    await supabase
      .from("paper_sheet_uploads")
      .update({
        ai_status: "processing",
        ai_error: null,
        ai_provider: "claude",
        ai_model: model,
      })
      .eq("id", uploadId);

    const { data: fileBlob, error: fileError } = await supabase.storage
      .from("paper-sheets")
      .download(upload.file_path);

    if (fileError) throw fileError;
    if (!fileBlob) throw new Error("Unable to download paper sheet file.");

    const mediaType =
      upload.file_type || fileBlob.type || inferMediaType(upload.file_name);
    const fileBuffer = await fileBlob.arrayBuffer();
    const properties = await loadPropertyReferences(supabase);

    let claudeResult: Record<string, unknown>;

    if (mediaType === "application/pdf") {
      claudeResult = await scanPdfPageByPage({
        apiKey: anthropicApiKey,
        model,
        fileBuffer,
        upload,
        properties,
      });
    } else {
      claudeResult = await scanMileageSheetWithClaude({
        apiKey: anthropicApiKey,
        model,
        base64File: arrayBufferToBase64(fileBuffer),
        mediaType,
        upload,
        properties,
      });
    }

    const rows = normalizeRows({
      result: claudeResult,
      upload,
      properties,
    });

    const { error: deleteExistingError } = await supabase
      .from("paper_sheet_draft_entries")
      .delete()
      .eq("upload_id", uploadId);

    if (deleteExistingError) throw deleteExistingError;

    if (rows.length > 0) {
      const { error: insertRowsError } = await supabase
        .from("paper_sheet_draft_entries")
        .insert(
          rows.map((row) => ({
            ...row,
            upload_id: uploadId,
            worker_id: upload.worker_id,
          }))
        );

      if (insertRowsError) throw insertRowsError;
    }

    const totalMileage = rows.reduce((total, row) => {
      return total + Number(row.miles || 0);
    }, 0);
    const needsReview = rows.some((row) => row.needs_review);

    const { error: updateUploadError } = await supabase
      .from("paper_sheet_uploads")
      .update({
        ai_status: needsReview ? "needs_review" : "converted",
        status: "reviewing",
        total_mileage_detected: totalMileage,
        ai_error: needsReview
          ? "AI scan found one or more rows that need review before submitting."
          : null,
        ai_provider: "claude",
        ai_model: model,
      })
      .eq("id", uploadId);

    if (updateUploadError) throw updateUploadError;

    return jsonResponse({
      ok: true,
      provider: "claude",
      model,
      rowCount: rows.length,
      needsReview,
      totalMileage,
    });
  } catch (error) {
    console.error(error);

    try {
      if (uploadId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") || "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
          { auth: { persistSession: false } }
        );
        await supabase
          .from("paper_sheet_uploads")
          .update({
            ai_status: "failed",
            ai_error: getErrorMessage(error),
          })
          .eq("id", uploadId);
      }
    } catch {
      // Best-effort failure status only.
    }

    return jsonResponse({ error: getErrorMessage(error) }, 500);
  }
});

async function scanPdfPageByPage({
  apiKey,
  model,
  fileBuffer,
  upload,
  properties,
}: {
  apiKey: string;
  model: string;
  fileBuffer: ArrayBuffer;
  upload: Record<string, unknown>;
  properties: Array<Record<string, string>>;
}) {
  let pdfDoc: PDFDocument;

  try {
    pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  } catch (error) {
    console.warn(
      "pdf-lib could not read the PDF; falling back to whole-file scan.",
      error
    );
    return await scanMileageSheetWithClaude({
      apiKey,
      model,
      base64File: arrayBufferToBase64(fileBuffer),
      mediaType: "application/pdf",
      upload,
      properties,
    });
  }

  const pageCount = pdfDoc.getPageCount();

  if (pageCount <= 1) {
    return await scanMileageSheetWithClaude({
      apiKey,
      model,
      base64File: arrayBufferToBase64(fileBuffer),
      mediaType: "application/pdf",
      upload,
      properties,
    });
  }

  // Split every page into its own single-page PDF so each AI request
  // only ever needs to return one page of rows. This keeps responses
  // small regardless of how many pages the uploaded sheet has.
  const pageBase64List: string[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageIndex]);
    singlePageDoc.addPage(copiedPage);
    const pageBytes = await singlePageDoc.save();
    pageBase64List.push(
      arrayBufferToBase64(
        pageBytes.buffer.slice(
          pageBytes.byteOffset,
          pageBytes.byteOffset + pageBytes.byteLength
        )
      )
    );
  }

  const pageResults: Array<Record<string, unknown> | null> = new Array(
    pageCount
  ).fill(null);
  const pageErrors: string[] = [];

  for (
    let batchStart = 0;
    batchStart < pageCount;
    batchStart += PAGE_SCAN_CONCURRENCY
  ) {
    const batchIndexes = [];

    for (
      let index = batchStart;
      index < Math.min(batchStart + PAGE_SCAN_CONCURRENCY, pageCount);
      index += 1
    ) {
      batchIndexes.push(index);
    }

    await Promise.all(
      batchIndexes.map(async (pageIndex) => {
        try {
          pageResults[pageIndex] = await scanMileageSheetWithClaude({
            apiKey,
            model,
            base64File: pageBase64List[pageIndex],
            mediaType: "application/pdf",
            upload,
            properties,
            pageNumber: pageIndex + 1,
            pageCount,
          });
        } catch (error) {
          console.error(`Page ${pageIndex + 1} scan failed.`, error);
          pageErrors.push(
            `Page ${pageIndex + 1}: ${getErrorMessage(error)}`
          );
        }
      })
    );
  }

  if (pageResults.every((result) => result === null)) {
    throw new Error(
      "AI scan failed for every page of the PDF. " + pageErrors.join(" | ")
    );
  }

  // Merge page results into one combined result.
  const combinedRows: Array<Record<string, unknown>> = [];
  let driver = "";
  let vehicle = "";
  const warnings: string[] = [...pageErrors];

  pageResults.forEach((result, pageIndex) => {
    if (!result) {
      warnings.push(
        `Page ${pageIndex + 1} could not be scanned and was skipped.`
      );
      return;
    }

    if (!driver && result.driver) driver = String(result.driver);
    if (!vehicle && result.vehicle) vehicle = String(result.vehicle);

    const rowsForPage = collectClaudeRows(result);

    for (const row of rowsForPage) {
      if (row && typeof row === "object") {
        combinedRows.push({
          page_number: pageIndex + 1,
          ...(row as Record<string, unknown>),
        });
      }
    }

    const resultSummary = result.summary as
      | Record<string, unknown>
      | undefined;

    if (Array.isArray(resultSummary?.warnings)) {
      for (const warning of resultSummary.warnings) {
        if (warning) warnings.push(`Page ${pageIndex + 1}: ${warning}`);
      }
    }
  });

  return {
    driver,
    vehicle,
    rows: combinedRows,
    summary: {
      total_miles: combinedRows.reduce((total, row) => {
        const miles = Number((row as Record<string, unknown>).miles || 0);
        return total + (Number.isFinite(miles) ? miles : 0);
      }, 0),
      warnings,
    },
  };
}

async function scanMileageSheetWithClaude({
  apiKey,
  model,
  base64File,
  mediaType,
  upload,
  properties,
  pageNumber,
  pageCount,
}: {
  apiKey: string;
  model: string;
  base64File: string;
  mediaType: string;
  upload: Record<string, unknown>;
  properties: Array<Record<string, string>>;
  pageNumber?: number;
  pageCount?: number;
}) {
  const fileBlock = buildClaudeFileBlock({ base64File, mediaType });
  const isSinglePageOfLargerPdf = Boolean(pageNumber && pageCount);
  const pageContext = isSinglePageOfLargerPdf
    ? `\nThis file is PAGE ${pageNumber} of ${pageCount} of one continuous mileage sheet. Extract ONLY the rows visible on this page. Number rows starting from 1 for this page; the app renumbers across pages.\n`
    : "";
  const propertyReference = properties
    .slice(0, 900)
    .map((property) => {
      return [
        property.property_code,
        property.house_number,
        property.street_name,
        property.street_type,
        property.city,
        property.display_label || property.display_name,
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("\n");

  const prompt = `
You are scanning a Prosper Real Estate mileage recording paper sheet.
${pageContext}
Return ONLY valid JSON. Do not include markdown.

Goal:
- Extract rows into the same fields used by the Mileage Tracker draft table.
- If the uploaded file is a PDF, scan every page in page order, not only the first page.
- Treat a multi-page PDF as one continuous mileage sheet and return every mileage row from every page.
- Renumber the extracted rows continuously across the whole file. Do not restart entry numbers on each PDF page.
- Use the uploaded sheet month (${upload.month_key || "unknown"}) to resolve short dates like 6/11/26.
- If a handwritten word or number is unclear, put "not readable" in the field, set needs_review true, and explain in review_notes.
- If property text is abbreviated, use the property reference list to pick the best property_code.
- If the property cannot be matched confidently, leave property_code blank, keep property_text, and set needs_review true.
- If miles is missing but start and end odometer are readable, calculate miles as end minus start.
- If calculated miles disagrees with written miles, keep the calculated miles and set needs_review true.
- Preserve useful purpose keywords such as lawn care, brush pickup, maintenance, water leak, filters, showing, inspection, lockbox, keys, signs, supplies, fuel, vehicle service.
- Do not guess beyond the page. Mark unclear fields as not readable.

Expected JSON shape:
{
  "driver": "string or empty",
  "vehicle": "string or empty",
  "rows": [
    {
      "entry_number": 1,
      "page_number": 1,
      "entry_date": "YYYY-MM-DD or empty",
      "vehicle": "string or empty",
      "property_text": "string or not readable",
      "property_code": "string or empty",
      "start_odometer": 123,
      "end_odometer": 124,
      "miles": 1,
      "purpose": "string or not readable",
      "needs_review": true,
      "review_notes": "short note for worker/admin",
      "ai_confidence": 0.0
    }
  ],
  "summary": {
    "total_miles": 0,
    "warnings": []
  }
}

You may also return page-by-page rows for large PDFs:
{
  "driver": "",
  "vehicle": "",
  "pages": [
    {
      "page_number": 1,
      "rows": []
    }
  ],
  "summary": {
    "total_miles": 0,
    "warnings": []
  }
}

If you use "pages", every row still needs the same row fields. The app will flatten pages into one editable table.

Property reference list:
${propertyReference || "No property reference rows were available."}
`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_SCAN_OUTPUT_TOKENS,
      temperature: 0,
      system:
        "You are a careful OCR and data-entry assistant. You extract mileage sheet rows accurately and flag uncertainty instead of guessing.",
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  const json = await response.json();

  if (!response.ok || json.error) {
    console.error(JSON.stringify(json, null, 2));
    throw new Error(json.error?.message || "AI paper sheet scan failed.");
  }

  const text = (json.content || [])
    .filter((part: { type?: string }) => part.type === "text")
    .map((part: { text?: string }) => part.text || "")
    .join("\n")
    .trim();

  return parseClaudeJson(text);
}

function buildClaudeFileBlock({
  base64File,
  mediaType,
}: {
  base64File: string;
  mediaType: string;
}) {
  if (mediaType === "application/pdf") {
    return {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64File,
      },
    };
  }

  if (mediaType.startsWith("image/")) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64File,
      },
    };
  }

  throw new Error(
    "AI scanning currently supports PDF, JPG, PNG, and WEBP mileage sheets."
  );
}

function normalizeRows({
  result,
  upload,
  properties,
}: {
  result: Record<string, unknown>;
  upload: Record<string, unknown>;
  properties: Array<Record<string, string>>;
}) {
  const propertyCodeSet = new Set(
    properties.map((property) => String(property.property_code || ""))
  );
  const defaultVehicle = String(result.vehicle || "").trim();
  const rows = collectClaudeRows(result);

  return rows.map((rawRow, index) => {
    const row = rawRow as Record<string, unknown>;
    const start = toNumberOrNull(row.start_odometer);
    const end = toNumberOrNull(row.end_odometer);
    const calculatedMiles = start !== null && end !== null ? end - start : null;
    const enteredMiles = toNumberOrNull(row.miles);
    const miles =
      calculatedMiles !== null && calculatedMiles >= 0
        ? calculatedMiles
        : enteredMiles;
    const propertyCode = String(row.property_code || "").trim().toUpperCase();
    const reviewNotes = buildReviewNotes({
      row,
      propertyCode,
      propertyCodeSet,
      calculatedMiles,
      enteredMiles,
    });

    return {
      entry_number: index + 1,
      entry_date: normalizeDate(row.entry_date, String(upload.month_key || "")),
      vehicle: String(row.vehicle || defaultVehicle || "").trim(),
      property_text: String(row.property_text || "").trim(),
      property_code: propertyCodeSet.has(propertyCode) ? propertyCode : propertyCode,
      start_odometer: start,
      end_odometer: end,
      miles,
      purpose: String(row.purpose || "").trim(),
      ai_confidence: clampConfidence(row.ai_confidence),
      review_notes: reviewNotes,
      needs_review:
        Boolean(row.needs_review) ||
        reviewNotes.length > 0 ||
        !propertyCode ||
        !propertyCodeSet.has(propertyCode) ||
        start === null ||
        end === null ||
        miles === null,
    };
  });
}

function collectClaudeRows(result: Record<string, unknown>) {
  if (Array.isArray(result.rows)) {
    return result.rows;
  }

  if (!Array.isArray(result.pages)) {
    return [];
  }

  return result.pages.flatMap((page, pageIndex) => {
    const pageRecord = page as Record<string, unknown>;
    const pageNumber =
      toNumberOrNull(pageRecord.page_number) ||
      toNumberOrNull(pageRecord.page) ||
      pageIndex + 1;
    const pageRows = Array.isArray(pageRecord.rows) ? pageRecord.rows : [];

    return pageRows.map((row) => {
      if (!row || typeof row !== "object") {
        return row;
      }

      return {
        page_number: pageNumber,
        ...(row as Record<string, unknown>),
      };
    });
  });
}

function buildReviewNotes({
  row,
  propertyCode,
  propertyCodeSet,
  calculatedMiles,
  enteredMiles,
}: {
  row: Record<string, unknown>;
  propertyCode: string;
  propertyCodeSet: Set<string>;
  calculatedMiles: number | null;
  enteredMiles: number | null;
}) {
  const notes = [];
  const rawNotes = String(row.review_notes || "").trim();

  if (rawNotes) notes.push(rawNotes);

  for (const field of [
    "entry_date",
    "vehicle",
    "property_text",
    "start_odometer",
    "end_odometer",
    "purpose",
  ]) {
    if (String(row[field] || "").toLowerCase().includes("not readable")) {
      notes.push(`${field.replaceAll("_", " ")} is not readable`);
    }
  }

  if (!propertyCode) {
    notes.push("property code needs review");
  } else if (!propertyCodeSet.has(propertyCode)) {
    notes.push("property code was not found in the property list");
  }

  if (
    calculatedMiles !== null &&
    enteredMiles !== null &&
    Math.abs(calculatedMiles - enteredMiles) > 0.01
  ) {
    notes.push("written miles did not match odometer calculation");
  }

  return Array.from(new Set(notes)).join("; ");
}

async function loadPropertyReferences(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("properties")
    .select(
      "property_code, house_number, street_name, street_type, city, display_label, display_name"
    )
    .order("property_code", { ascending: true })
    .limit(1200);

  if (error) {
    console.warn("Unable to load property references.", error);
    return [];
  }

  return data || [];
}

function parseClaudeJson(text: string) {
  const cleanText = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const firstBrace = cleanText.indexOf("{");
  const lastBrace = cleanText.lastIndexOf("}");

  if (firstBrace === -1) {
    throw new Error("AI scan did not return JSON for the paper sheet scan.");
  }

  if (lastBrace !== -1) {
    try {
      return JSON.parse(cleanText.slice(firstBrace, lastBrace + 1));
    } catch {
      // Fall through to truncation salvage below.
    }
  }

  const salvaged = salvageTruncatedJson(cleanText.slice(firstBrace));

  if (salvaged) {
    return salvaged;
  }

  throw new Error(
    "AI scan returned JSON that could not be parsed, even after attempting to repair a truncated response."
  );
}

// If the model response was cut off mid-array (for example by the output
// token limit), keep every complete row object and close the JSON so the
// scan still succeeds with the rows that were fully returned.
function salvageTruncatedJson(text: string) {
  let depth = 0;
  let inString = false;
  let isEscaped = false;
  let lastCompleteRowEnd = -1;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (character === "\\") {
      isEscaped = true;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (character === "{" || character === "[") {
      depth += 1;
    } else if (character === "}" || character === "]") {
      depth -= 1;

      // depth 2 means we just closed an object inside the top-level
      // "rows" array: { "rows": [ {...}<-- here
      if (character === "}" && depth === 2) {
        lastCompleteRowEnd = index;
      }
    }
  }

  if (lastCompleteRowEnd === -1) return null;

  const candidate = text.slice(0, lastCompleteRowEnd + 1) + "]}";

  try {
    const parsed = JSON.parse(candidate);
    console.warn(
      "AI response was truncated. Salvaged " +
        (Array.isArray(parsed.rows) ? parsed.rows.length : 0) +
        " complete rows."
    );
    return parsed;
  } catch {
    return null;
  }
}

function normalizeDate(value: unknown, monthKey: string) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (!text || text.toLowerCase().includes("not readable")) return null;

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  const match = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (!match) return null;

  const [, monthText, dayText, yearText] = match;
  let year = yearText ? Number(yearText) : Number(monthKey.slice(0, 4));
  if (year < 100) year += 2000;

  return `${year}-${String(Number(monthText)).padStart(2, "0")}-${String(
    Number(dayText)
  ).padStart(2, "0")}`;
}

function toNumberOrNull(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const numberValue = Number(String(value).replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(numberValue) ? numberValue : null;
}

function clampConfidence(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.max(0, Math.min(1, numberValue));
}

function inferMediaType(fileName = "") {
  const cleanName = String(fileName).toLowerCase();
  if (cleanName.endsWith(".pdf")) return "application/pdf";
  if (cleanName.endsWith(".png")) return "image/png";
  if (cleanName.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return btoa(binary);
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name} environment variable.`);
  return value;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown error");
}