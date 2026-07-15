import JobberVisitPicker from "../components/JobberVisitPicker";
import JohnnyChatShell from "../components/JohnnyChatShell";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  BookOpen,
  Bot,
  CalendarDays,
  Car,
  ClipboardList,
  Download,
  ExternalLink,
  FileUp,
  Gauge,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Route,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { askClaudeAssistant } from "../services/claudeAssistantService";
import { invokeSupabaseFunction } from "../services/supabaseFunctionService";
import { signOutUser } from "../services/authService";
import { getProfileForUser } from "../services/profileService";
import { getProperties } from "../services/propertyService";
import { getWorkerVehicles } from "../services/vehicleService";
import {
  calculateMilesFromOdometer,
  deleteMileageEntry,
  formatMonthKey,
  getCurrentMonthKey,
  getEntriesForMonth,
  getMileageSummary,
  getMonthKeyFromDate,
  getMonthOptionsFromEntries,
  getTodayInputValue,
  getWorkerMileageEntries,
  saveWorkerMileageEntry,
} from "../services/mileageService";

import {
  getJobberVisitsForMonth,
} from "../services/jobberService";
import {
  getBusinessCategoryLabelForEntry,
  getMileageBucketLabelForEntry,
} from "../services/mileageWorkflowService";
import { resolvePropertyCode } from "../services/propertyCodeService";
import {
  getExpectedVehicleStart,
  getVehicleOdometerStates,
  requiresOdometerOverride,
} from "../services/vehicleOdometerService";
import {
  formatTimesheetDuration,
  getTimesheetDateInputValue,
  getTimesheetDisplayTitle,
  getTimesheetMileagePurpose,
  getTimesheetMileageStatus,
  getTimesheetMonthKey,
  getTimesheetPropertyCode,
  getTimesheetPropertyDisplay,
  getWorkerJobberTimesheets,
  isActiveJob,
  isTimesheetMileageCompleted,
  mapTimesheetToMileageJobberFields,
  removeJobberTimesheet,
} from "../services/jobberTimesheetService";

const logoPaths = [
  "/prosper-logo.svg",
  "/prosper-logo.png",
  "/logo.svg",
  "/logo.png",
];

const WORKER_MANUAL_URL = "/manuals/mileage-tracker-worker-user-manual.pdf";
const OTHER_COMPANY_VEHICLE_ID = "__other_company_vehicle__";

const navigationItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "new-entry", label: "New Mileage Entry", icon: Plus },
  { id: "timesheets", label: "Timesheets", icon: CalendarDays },
  { id: "history", label: "Mileage History", icon: History },
  { id: "upload", label: "Upload Paper Sheet", icon: FileUp },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "help", label: "Help", icon: HelpCircle },
];

const blankForm = {
  entryDate: getTodayInputValue(),
  vehicleId: "",
  customVehicleName: "",
  propertyCode: "",
  startOdometer: "",
  expectedStartOdometer: "",
  usesSharedVehicleOdometer: false,
  odometerOverrideReason: "",
  endOdometer: "",
  purpose: "",
};

const blankEditForm = {
  id: "",
  entryDate: "",
  vehicleName: "",
  customVehicleName: "",
  propertyCode: "",
  startOdometer: "",
  expectedStartOdometer: "",
  usesSharedVehicleOdometer: false,
  odometerOverrideReason: "",
  endOdometer: "",
  purpose: "",
};

const blankTimesheetMileageForm = {
  timesheetId: "",
  vehicleId: "",
  customVehicleName: "",
  startOdometer: "",
  expectedStartOdometer: "",
  usesSharedVehicleOdometer: false,
  odometerOverrideReason: "",
  endOdometer: "",
  purpose: "",
};

const inputClass =
  "h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export default function WorkerDashboard() {
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState("overview");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [entries, setEntries] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleOdometerStates, setVehicleOdometerStates] = useState([]);
  const [properties, setProperties] = useState([]);

  const [jobberVisits, setJobberVisits] = useState([]);
  const [selectedJobberVisit, setSelectedJobberVisit] = useState(null);
  const [jobberTimesheets, setJobberTimesheets] = useState([]);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  const [form, setForm] = useState(blankForm);
  const [entryBatchRows, setEntryBatchRows] = useState([]);
  const [savingEntry, setSavingEntry] = useState(false);
  const [savingEntryBatch, setSavingEntryBatch] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [timesheetMileageForm, setTimesheetMileageForm] = useState(
    blankTimesheetMileageForm
  );
  const [savingTimesheetMileage, setSavingTimesheetMileage] = useState(false);
  const [deletingTimesheetId, setDeletingTimesheetId] = useState("");
  const [timesheetError, setTimesheetError] = useState("");
  const [timesheetSuccess, setTimesheetSuccess] = useState("");

  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState(blankEditForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const [messages, setMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState("");

  const [paperUploads, setPaperUploads] = useState([]);
  const [uploadMonthKey, setUploadMonthKey] = useState(getCurrentMonthKey());
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadingSheet, setUploadingSheet] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const [paperDraftEntries, setPaperDraftEntries] = useState([]);
  const [selectedPaperUploadId, setSelectedPaperUploadId] = useState("");
  const [convertingUploadId, setConvertingUploadId] = useState("");
  const [savingDraftUploadId, setSavingDraftUploadId] = useState("");
  const [submittingDraftUploadId, setSubmittingDraftUploadId] = useState("");
  const [draftError, setDraftError] = useState("");
  const [draftSuccess, setDraftSuccess] = useState("");
  const paperDraftHasUnsavedEditsRef = useRef(false);

  const calculatedMiles = useMemo(() => {
    return calculateMilesFromOdometer(form.startOdometer, form.endOdometer);
  }, [form.startOdometer, form.endOdometer]);

  const editCalculatedMiles = useMemo(() => {
    return calculateMilesFromOdometer(
      editForm.startOdometer,
      editForm.endOdometer
    );
  }, [editForm.startOdometer, editForm.endOdometer]);

  const timesheetCalculatedMiles = useMemo(() => {
    return calculateMilesFromOdometer(
      timesheetMileageForm.startOdometer,
      timesheetMileageForm.endOdometer
    );
  }, [timesheetMileageForm.startOdometer, timesheetMileageForm.endOdometer]);

  const selectedTimesheet = useMemo(() => {
    if (!timesheetMileageForm.timesheetId) return null;

    return (
      jobberTimesheets.find(
        (timesheet) => String(timesheet.id) === String(timesheetMileageForm.timesheetId)
      ) || null
    );
  }, [jobberTimesheets, timesheetMileageForm.timesheetId]);

  const selectedMonthTimesheets = useMemo(() => {
    return (jobberTimesheets || []).filter((timesheet) => {
      return getTimesheetMonthKey(timesheet) === selectedMonth;
    });
  }, [jobberTimesheets, selectedMonth]);

  const timesheetMap = useMemo(() => {
    return new Map(
      (jobberTimesheets || []).map((timesheet) => [String(timesheet.id), timesheet])
    );
  }, [jobberTimesheets]);

  const monthOptions = useMemo(() => {
    const options = getMonthOptionsFromEntries(entries);

    for (const timesheet of jobberTimesheets || []) {
      const monthKey = getTimesheetMonthKey(timesheet);
      if (monthKey) options.push(monthKey);
    }

    if (!options.includes(getCurrentMonthKey())) {
      options.unshift(getCurrentMonthKey());
    }

    return Array.from(new Set(options)).sort().reverse();
  }, [entries, jobberTimesheets]);

  const selectedMonthEntries = useMemo(() => {
    return getEntriesForMonth(entries, selectedMonth);
  }, [entries, selectedMonth]);

  const selectedMonthSummary = useMemo(() => {
    return getMileageSummary(selectedMonthEntries);
  }, [selectedMonthEntries]);

  const latestEntry = entries?.[0] || null;

  const activeVehicle = formatVehicleNameForDisplay(
    latestEntry?.vehicle || "Not Selected",
    profile
  );

  const sidebarBadgeCounts = useMemo(() => {
    const unreadMessages = messages.filter((message) => {
      return message.sender_role === "admin" && message.is_read === false;
    }).length;

    return {
      messages: unreadMessages,
    };
  }, [messages]);
  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadJobberVisits() {
      try {
        const visits = await getJobberVisitsForMonth(selectedMonth);

        if (isActive) {
          setJobberVisits(visits);
        }
      } catch (error) {
        console.error(error);

        if (isActive) {
          setJobberVisits([]);
        }
      }
    }

    loadJobberVisits();

    return () => {
      isActive = false;
    };
  }, [selectedMonth]);

  useEffect(() => {
    if (!profile?.id) return undefined;

    let refreshTimer = null;

    function scheduleRealtimeRefresh() {
      window.clearTimeout(refreshTimer);

      refreshTimer = window.setTimeout(() => {
          refreshAllWorkerData(profile.id, profile.email || user?.email || "").catch((error) => {
          console.error(error);
          setDataError(
            error?.message ||
              "Realtime refresh failed. Please check Supabase Realtime and RLS policies."
          );
        });
      }, 250);
    }

    function schedulePaperDraftRealtimeRefresh() {
      if (paperDraftHasUnsavedEditsRef.current) return;
      scheduleRealtimeRefresh();
    }

    const channel = supabase
      .channel(`worker-dashboard-live-sync-${profile.id}`)
      .on(
  "postgres_changes",
  { event: "*", schema: "public", table: "jobber_timesheets" },
  scheduleRealtimeRefresh
)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mileage_entries" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mileage_sheets" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicle_odometer_states" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "worker_vehicle_assignments",
        },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "properties" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "paper_sheet_uploads" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "paper_sheet_draft_entries" },
        schedulePaperDraftRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobber_timesheets" },
        scheduleRealtimeRefresh
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn(
            "Realtime channel error. Make sure Supabase Realtime is enabled for the mileage tables."
          );
        }
      });

    return () => {
      window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.email, user?.email]);

  useEffect(() => {
    if (activeView !== "messages" || !profile?.id) return;

    markAdminMessagesRead(profile.id).catch((error) => {
      console.error(error);
    });
  }, [activeView, profile?.id, messages.length]);

  async function loadDashboard() {
    setLoading(true);
    setDataError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      navigate("/login");
      return;
    }

    setUser(session.user);

    try {
      const workerProfile = await getProfileForUser(session.user);

      if (!workerProfile) {
        navigate("/onboarding");
        return;
      }

      setProfile(workerProfile);

      const {
        workerEntries,
        workerVehicles,
        sharedVehicleOdometers,
      } = await refreshAllWorkerData(
        workerProfile.id,
        workerProfile.email || session.user.email || ""
      );

      if (workerVehicles.length > 0) {
        const defaultVehicle = getPreferredWorkerVehicle(
          workerVehicles,
          workerProfile
        );
        const defaultVehicleName = getWorkerVehicleDisplayName(
          defaultVehicle,
          workerProfile
        );
        const fallbackOdometer = getLatestEndOdometerForVehicle(
          workerEntries,
          defaultVehicleName
        );
        const odometerStart = getExpectedVehicleStart({
          states: sharedVehicleOdometers,
          vehicle: defaultVehicle,
          vehicleName: defaultVehicleName,
          fallbackOdometer,
        });

        setForm((currentForm) => ({
          ...currentForm,
          vehicleId: defaultVehicle.id,
          startOdometer:
            currentForm.startOdometer ||
            String(odometerStart.expectedStartOdometer || ""),
          expectedStartOdometer: String(
            odometerStart.expectedStartOdometer || ""
          ),
          usesSharedVehicleOdometer: odometerStart.isSharedVehicle,
        }));
      }

      setSelectedMonth(getCurrentMonthKey());
    } catch (error) {
      console.error(error);
      setDataError(
        error?.message ||
          "Unable to load your mileage data. Please check Supabase policies."
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshAllWorkerData(workerId, workerEmail = "") {
    const [
      workerEntries,
      workerVehicles,
      sharedVehicleOdometers,
      propertyList,
      workerMessages,
      workerPaperUploads,
      workerDraftEntries,
      workerTimesheets,
    ] = await Promise.all([
      getWorkerMileageEntries(workerId),
      getWorkerVehicles(workerId),
      getVehicleOdometerStates(),
      getProperties(),
      getWorkerMessages(workerId),
      getWorkerPaperSheetUploads(workerId),
      getWorkerPaperSheetDraftEntries(workerId),
      getWorkerJobberTimesheets(workerEmail),
    ]);

    setEntries(workerEntries);
    setVehicles(workerVehicles);
    setVehicleOdometerStates(sharedVehicleOdometers);
    setProperties(propertyList);
    setMessages(workerMessages);
    setPaperUploads(workerPaperUploads);
    setPaperDraftEntries((currentRows) =>
      paperDraftHasUnsavedEditsRef.current ? currentRows : workerDraftEntries
    );
    setJobberTimesheets(workerTimesheets);

    return {
      workerEntries,
      workerVehicles,
      sharedVehicleOdometers,
      propertyList,
      workerMessages,
      workerPaperUploads,
      workerDraftEntries,
      workerTimesheets,
    };
  }

  async function refreshEntries(workerId) {
    const freshEntries = await getWorkerMileageEntries(workerId);
    setEntries(freshEntries);
    return freshEntries;
  }

  function updateForm(field, value) {
    setForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [field]: value,
      };

      if (field === "vehicleId") {
        const selectedVehicle =
          value === OTHER_COMPANY_VEHICLE_ID
            ? null
            : vehicles.find((vehicle) => vehicle.id === value);
        const selectedVehicleName =
          value === OTHER_COMPANY_VEHICLE_ID
            ? currentForm.customVehicleName
            : getWorkerVehicleDisplayName(selectedVehicle, profile);
        const fallbackOdometer = getLatestEndOdometerForVehicle(
          entries,
          selectedVehicleName
        );
        const odometerStart = getExpectedVehicleStart({
          states: vehicleOdometerStates,
          vehicle: selectedVehicle,
          vehicleName: selectedVehicleName,
          fallbackOdometer,
        });

        nextForm.startOdometer = String(odometerStart.expectedStartOdometer || "");
        nextForm.expectedStartOdometer = String(
          odometerStart.expectedStartOdometer || ""
        );
        nextForm.usesSharedVehicleOdometer = odometerStart.isSharedVehicle;
        nextForm.odometerOverrideReason = "";
        nextForm.endOdometer = "";
        nextForm.purpose = syncPurposeWithVehicleUnitPrefix(
          currentForm.purpose,
          selectedVehicle || selectedVehicleName
        );
      }

      if (
        field === "customVehicleName" &&
        currentForm.vehicleId === OTHER_COMPANY_VEHICLE_ID
      ) {
        const odometerStart = getExpectedVehicleStart({
          states: vehicleOdometerStates,
          vehicle: null,
          vehicleName: value,
          fallbackOdometer: "",
        });

        nextForm.startOdometer = value
          ? String(odometerStart.expectedStartOdometer || "")
          : "";
        nextForm.expectedStartOdometer = value
          ? String(odometerStart.expectedStartOdometer || "")
          : "";
        nextForm.usesSharedVehicleOdometer = Boolean(value);
        nextForm.odometerOverrideReason = "";
        nextForm.endOdometer = "";
        nextForm.purpose = syncPurposeWithVehicleUnitPrefix(
          currentForm.purpose,
          value
        );
      }

      return nextForm;
    });

    setFormError("");
    setFormSuccess("");
  }

  function updateEditForm(field, value) {
    setEditForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));

    setEditError("");
    setEditSuccess("");
  }

  function buildWorkerEntryBatchRowFromForm() {
    if (!profile) {
      throw new Error("Worker profile is missing.");
    }

    const selectedVehicle = vehicles.find(
      (vehicle) => vehicle.id === form.vehicleId
    );
    const vehicleName = getWorkerFormVehicleName(form, vehicles, profile);

    if (!vehicleName) {
      throw new Error("Please select a vehicle or enter the other company vehicle name.");
    }

    const selectedProperty = properties.find(
      (property) => property.property_code === form.propertyCode
    );

    if (!selectedJobberVisit && !selectedProperty) {
      throw new Error("Please select a Jobber Visit or Property before adding the row.");
    }

    if (
      requiresOdometerOverride({
        isSharedVehicle: form.usesSharedVehicleOdometer,
        startOdometer: form.startOdometer,
        expectedStartOdometer: form.expectedStartOdometer,
      }) &&
      !form.odometerOverrideReason.trim()
    ) {
      throw new Error(
        "Start odometer does not match the shared vehicle odometer. Please enter an override reason."
      );
    }

    const propertyCode = selectedJobberVisit
      ? resolvePropertyCode({
          address: selectedJobberVisit.jobberPropertyAddress,
          properties,
          fallbackCode:
            selectedJobberVisit.jobberPropertyId || selectedJobberVisit.jobberVisitId,
        })
      : selectedProperty?.property_code;

    const propertyDisplay = selectedJobberVisit
      ? selectedJobberVisit.jobberPropertyAddress ||
        selectedJobberVisit.jobberJobTitle ||
        "Jobber Visit"
      : selectedProperty?.display_label ||
        selectedProperty?.display_name ||
        selectedProperty?.property_code;

    return {
      id: "batch-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      entryDate: form.entryDate,
      vehicleId: selectedVehicle?.id || "",
      vehicleName,
      propertyCode,
      propertyDisplay,
      startOdometer: form.startOdometer,
      endOdometer: form.endOdometer,
      expectedStartOdometer: form.expectedStartOdometer,
      usesSharedVehicleOdometer: form.usesSharedVehicleOdometer,
      odometerOverrideReason: form.odometerOverrideReason,
      purpose: form.purpose,
      jobberVisit: selectedJobberVisit,
    };
  }

  function handleAddEntryBatchRow() {
    try {
      const nextRow = buildWorkerEntryBatchRowFromForm();

      setEntryBatchRows((currentRows) => [...currentRows, nextRow]);
      setForm((currentForm) => ({
        ...blankForm,
        entryDate: currentForm.entryDate,
        vehicleId: currentForm.vehicleId,
        customVehicleName: currentForm.customVehicleName,
        startOdometer: currentForm.endOdometer,
        expectedStartOdometer: currentForm.endOdometer,
        usesSharedVehicleOdometer: currentForm.usesSharedVehicleOdometer,
        odometerOverrideReason: "",
        endOdometer: "",
        purpose: currentForm.purpose,
      }));
      setSelectedJobberVisit(null);
      setFormError("");
      setFormSuccess("Row added to the batch. Add another row or submit the batch.");
    } catch (error) {
      setFormError(error?.message || "Unable to add row.");
      setFormSuccess("");
    }
  }

  function updateEntryBatchRow(rowId, field, value) {
    setEntryBatchRows((currentRows) =>
      currentRows.map((row) => {
        if (String(row.id) !== String(rowId)) return row;

        const nextRow = {
          ...row,
          [field]: field === "propertyCode" ? String(value || "").toUpperCase() : value,
        };

        if (field === "propertyCode") {
          nextRow.jobberVisit = null;
          const selectedProperty = findPropertyByCode(properties, nextRow.propertyCode);
          if (selectedProperty) {
            nextRow.propertyCode = selectedProperty.property_code;
            nextRow.propertyDisplay =
              selectedProperty.display_label ||
              selectedProperty.display_name ||
              selectedProperty.property_code;
            nextRow.jobberVisit = null;
          }
        }

        return nextRow;
      })
    );
  }

  function deleteEntryBatchRow(rowId) {
    setEntryBatchRows((currentRows) =>
      currentRows.filter((row) => String(row.id) !== String(rowId))
    );
  }

  async function handleSubmitEntryBatchRows() {
    if (!profile) {
      setFormError("Worker profile is missing.");
      return;
    }

    if (entryBatchRows.length === 0) {
      setFormError("Add at least one row before submitting the batch.");
      return;
    }

    const confirmed = window.confirm(
      `Submit ${entryBatchRows.length} mileage entries now?`
    );

    if (!confirmed) return;

    setSavingEntryBatch(true);
    setFormError("");
    setFormSuccess("");

    try {
      for (const row of entryBatchRows) {
        const selectedProperty = findPropertyByCode(properties, row.propertyCode);

        if (!row.jobberVisit && !selectedProperty) {
          throw new Error(
            `Entry ${row.entryDate || ""} needs a valid property code before submitting.`
          );
        }

        await saveWorkerMileageEntry({
          profile,
          entryDate: row.entryDate,
          vehicleId: row.vehicleId,
          vehicleName: row.vehicleName,
          propertyCode: row.propertyCode,
          propertyDisplay:
            row.propertyDisplay ||
            selectedProperty?.display_label ||
            selectedProperty?.display_name ||
            selectedProperty?.property_code,
          startOdometer: row.startOdometer,
          endOdometer: row.endOdometer,
          expectedStartOdometer: row.expectedStartOdometer || row.startOdometer,
          odometerOverrideReason: row.odometerOverrideReason || "",
          purpose: row.purpose,
          jobberVisit: row.jobberVisit,
        });
      }

      await refreshEntries(profile.id);
      const freshOdometerStates = await getVehicleOdometerStates();
      setVehicleOdometerStates(freshOdometerStates);
      setSelectedMonth(getMonthKeyFromDate(entryBatchRows[0].entryDate));
      setEntryBatchRows([]);
      setFormSuccess("Batch mileage entries saved successfully.");
    } catch (error) {
      console.error(error);
      setFormError(error?.message || "Unable to submit batch entries.");
    } finally {
      setSavingEntryBatch(false);
    }
  }

  async function handleSaveEntry(event) {
    event.preventDefault();

    if (!profile) {
      setFormError("Worker profile is missing.");
      return;
    }

    setSavingEntry(true);
    setFormError("");
    setFormSuccess("");

    try {
      const selectedVehicle = vehicles.find(
        (vehicle) => vehicle.id === form.vehicleId
      );
      const vehicleName = getWorkerFormVehicleName(form, vehicles, profile);

      if (!vehicleName) {
        throw new Error("Please select a vehicle or enter the other company vehicle name.");
      }

      const selectedProperty = properties.find(
        (property) => property.property_code === form.propertyCode
      );

      if (!selectedJobberVisit && !selectedProperty) {
        throw new Error("Please select a Jobber Visit or Property.");
      }

      if (
        requiresOdometerOverride({
          isSharedVehicle: form.usesSharedVehicleOdometer,
          startOdometer: form.startOdometer,
          expectedStartOdometer: form.expectedStartOdometer,
        }) &&
        !form.odometerOverrideReason.trim()
      ) {
        throw new Error(
          "Start odometer does not match the shared vehicle odometer. Please enter an override reason."
        );
      }

      const savedEntry = await saveWorkerMileageEntry({
        profile,
        entryDate: form.entryDate,
        vehicleId: selectedVehicle?.id || "",
        vehicleName,
        propertyCode: selectedJobberVisit
          ? resolvePropertyCode({
              address: selectedJobberVisit.jobberPropertyAddress,
              properties,
              fallbackCode:
                selectedJobberVisit.jobberPropertyId || selectedJobberVisit.jobberVisitId,
            })
          : selectedProperty?.property_code,
        propertyDisplay: selectedJobberVisit
          ? selectedJobberVisit.jobberPropertyAddress ||
            selectedJobberVisit.jobberJobTitle ||
            "Jobber Visit"
          : selectedProperty?.display_label ||
            selectedProperty?.display_name ||
            selectedProperty?.property_code,
        startOdometer: form.startOdometer,
        endOdometer: form.endOdometer,
        expectedStartOdometer: form.expectedStartOdometer,
        odometerOverrideReason: form.odometerOverrideReason,
        purpose: form.purpose,
        jobberVisit: selectedJobberVisit,
      });

      const freshEntries = await refreshEntries(profile.id);
      const freshOdometerStates = await getVehicleOdometerStates();
      setVehicleOdometerStates(freshOdometerStates);
      setSelectedMonth(getMonthKeyFromDate(savedEntry.entry_date));

      setForm((currentForm) => ({
        ...blankForm,
        entryDate: currentForm.entryDate,
        vehicleId: currentForm.vehicleId,
        customVehicleName: currentForm.customVehicleName,
        propertyCode: "",
        startOdometer: currentForm.endOdometer,
        expectedStartOdometer: currentForm.endOdometer,
        usesSharedVehicleOdometer: currentForm.usesSharedVehicleOdometer,
        odometerOverrideReason: "",
        endOdometer: "",
        purpose: currentForm.purpose,
      }));
      setSelectedJobberVisit(null);

      setFormSuccess(
        "Mileage entry saved successfully. The shared vehicle odometer is ready for the next driver."
      );

      if (freshEntries.length === 0) {
        setEntries([savedEntry]);
      }
    } catch (error) {
      console.error(error);
      setFormError(error?.message || "Unable to save mileage entry.");
    } finally {
      setSavingEntry(false);
    }
  }

  function openTimesheetMileageForm(timesheet) {
    const defaultVehicle = getPreferredWorkerVehicle(vehicles, profile);
    const defaultVehicleName = defaultVehicle
      ? getWorkerVehicleDisplayName(defaultVehicle, profile)
      : "";
    const latestEndOdometer = getLatestEndOdometerForVehicle(
      entries,
      defaultVehicleName
    );
    const odometerStart = getExpectedVehicleStart({
      states: vehicleOdometerStates,
      vehicle: defaultVehicle,
      vehicleName: defaultVehicleName,
      fallbackOdometer: latestEndOdometer,
    });

    setTimesheetMileageForm({
      ...blankTimesheetMileageForm,
      timesheetId: timesheet.id,
      vehicleId: defaultVehicle?.id || "",
      startOdometer: String(odometerStart.expectedStartOdometer || ""),
      expectedStartOdometer: String(odometerStart.expectedStartOdometer || ""),
      usesSharedVehicleOdometer: odometerStart.isSharedVehicle,
      odometerOverrideReason: "",
      purpose: getTimesheetMileagePurpose(timesheet),
    });
    setTimesheetError("");
    setTimesheetSuccess("");
  }

  function closeTimesheetMileageForm() {
    setTimesheetMileageForm(blankTimesheetMileageForm);
    setTimesheetError("");
    setTimesheetSuccess("");
  }

  function updateTimesheetMileageForm(field, value) {
    setTimesheetMileageForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [field]: value,
      };

      if (field === "vehicleId") {
        const selectedVehicle =
          value === OTHER_COMPANY_VEHICLE_ID
            ? null
            : vehicles.find((vehicle) => vehicle.id === value);
        const selectedVehicleName =
          value === OTHER_COMPANY_VEHICLE_ID
            ? currentForm.customVehicleName
            : getWorkerVehicleDisplayName(selectedVehicle, profile);
        const fallbackOdometer = getLatestEndOdometerForVehicle(
          entries,
          selectedVehicleName
        );
        const odometerStart = getExpectedVehicleStart({
          states: vehicleOdometerStates,
          vehicle: selectedVehicle,
          vehicleName: selectedVehicleName,
          fallbackOdometer,
        });

        nextForm.startOdometer = String(odometerStart.expectedStartOdometer || "");
        nextForm.expectedStartOdometer = String(
          odometerStart.expectedStartOdometer || ""
        );
        nextForm.usesSharedVehicleOdometer = odometerStart.isSharedVehicle;
        nextForm.odometerOverrideReason = "";
        nextForm.endOdometer = "";
        nextForm.purpose = syncPurposeWithVehicleUnitPrefix(
          currentForm.purpose,
          selectedVehicle || selectedVehicleName
        );
      }

      if (
        field === "customVehicleName" &&
        currentForm.vehicleId === OTHER_COMPANY_VEHICLE_ID
      ) {
        const odometerStart = getExpectedVehicleStart({
          states: vehicleOdometerStates,
          vehicle: null,
          vehicleName: value,
          fallbackOdometer: "",
        });

        nextForm.startOdometer = value
          ? String(odometerStart.expectedStartOdometer || "")
          : "";
        nextForm.expectedStartOdometer = value
          ? String(odometerStart.expectedStartOdometer || "")
          : "";
        nextForm.usesSharedVehicleOdometer = Boolean(value);
        nextForm.odometerOverrideReason = "";
        nextForm.endOdometer = "";
        nextForm.purpose = syncPurposeWithVehicleUnitPrefix(
          currentForm.purpose,
          value
        );
      }

      return nextForm;
    });

    setTimesheetError("");
    setTimesheetSuccess("");
  }

  async function handleCompleteTimesheetMileage(event) {
    event.preventDefault();

    if (!profile) {
      setTimesheetError("Worker profile is missing.");
      return;
    }

    if (!selectedTimesheet) {
      setTimesheetError("Please choose a Jobber timesheet.");
      return;
    }

    const selectedVehicle = vehicles.find(
      (vehicle) => vehicle.id === timesheetMileageForm.vehicleId
    );
    const vehicleName = getWorkerFormVehicleName(
      timesheetMileageForm,
      vehicles,
      profile
    );

    if (!vehicleName) {
      setTimesheetError("Please select a vehicle or enter the other company vehicle name.");
      return;
    }

    setSavingTimesheetMileage(true);
    setTimesheetError("");
    setTimesheetSuccess("");

    try {
      if (
        requiresOdometerOverride({
          isSharedVehicle: timesheetMileageForm.usesSharedVehicleOdometer,
          startOdometer: timesheetMileageForm.startOdometer,
          expectedStartOdometer: timesheetMileageForm.expectedStartOdometer,
        }) &&
        !timesheetMileageForm.odometerOverrideReason.trim()
      ) {
        throw new Error(
          "Start odometer does not match the shared vehicle odometer. Please enter an override reason."
        );
      }

      const savedEntry = await saveWorkerMileageEntry({
        profile,
        entryDate: getTimesheetDateInputValue(selectedTimesheet) || getTodayInputValue(),
        vehicleId: selectedVehicle?.id || "",
        vehicleName,
        propertyCode: resolvePropertyCode({
          address: selectedTimesheet.jobber_property_address,
          properties,
          fallbackCode: getTimesheetPropertyCode(selectedTimesheet),
        }),
        propertyDisplay: getTimesheetPropertyDisplay(selectedTimesheet),
        startOdometer: timesheetMileageForm.startOdometer,
        endOdometer: timesheetMileageForm.endOdometer,
        expectedStartOdometer: timesheetMileageForm.expectedStartOdometer,
        odometerOverrideReason: timesheetMileageForm.odometerOverrideReason,
        purpose: timesheetMileageForm.purpose,
        jobberVisit: mapTimesheetToMileageJobberFields(selectedTimesheet),
        jobberTimesheetId: selectedTimesheet.id,
      });

      const freshEntries = await refreshEntries(profile.id);
      const freshTimesheets = await getWorkerJobberTimesheets(
        profile.email || user?.email || ""
      );

      setJobberTimesheets(freshTimesheets);
      setVehicleOdometerStates(await getVehicleOdometerStates());
      setSelectedMonth(getMonthKeyFromDate(savedEntry.entry_date));
      setTimesheetSuccess("Mileage completed for this Jobber timesheet.");
      setTimesheetMileageForm(blankTimesheetMileageForm);

      if (freshEntries.length === 0) {
        setEntries([savedEntry]);
      }
    } catch (error) {
      console.error(error);
      setTimesheetError(error?.message || "Unable to complete timesheet mileage.");
    } finally {
      setSavingTimesheetMileage(false);
    }
  }

  async function handleRemoveTimesheet(timesheet) {
    if (!timesheet?.id || !profile?.id) {
      setTimesheetError("Jobber timesheet or worker profile is missing.");
      return;
    }

    const hasLinkedMileage =
      isTimesheetMileageCompleted(timesheet) || timesheet.mileage_entry_id;
    const confirmed = window.confirm(
      hasLinkedMileage
        ? "Remove this Jobber timesheet and its linked mileage entry? It will no longer appear in review, reports, or CSV downloads."
        : "Remove this Jobber timesheet from Mileage Tracker review? It will no longer appear for worker or admin."
    );

    if (!confirmed) return;

    setDeletingTimesheetId(timesheet.id);
    setTimesheetError("");
    setTimesheetSuccess("");

    try {
      await removeJobberTimesheet({
        timesheetId: timesheet.id,
        removedBy: profile.id,
        removedByRole: "worker",
        reason: "Worker removed this Jobber timesheet from Mileage Tracker review.",
      });

      await refreshAllWorkerData(profile.id, profile.email || user?.email || "");

      if (String(timesheetMileageForm.timesheetId) === String(timesheet.id)) {
        setTimesheetMileageForm(blankTimesheetMileageForm);
      }

      setTimesheetSuccess(
        hasLinkedMileage
          ? "Jobber timesheet and linked mileage entry removed from reports."
          : "Jobber timesheet removed from Mileage Tracker review."
      );
    } catch (error) {
      console.error(error);
      setTimesheetError(error?.message || "Unable to remove Jobber timesheet.");
    } finally {
      setDeletingTimesheetId("");
    }
  }

  function openEditEntry(entry) {
    setEditingEntry(entry);
    setEditError("");
    setEditSuccess("");

    setEditForm({
      id: entry.id,
      entryDate: toInputDateValue(getEntryDate(entry)),
      vehicleName: formatVehicleNameForDisplay(getEntryVehicle(entry), profile),
      propertyCode: getEntryPropertyCode(entry),
      startOdometer: stringifyValue(getEntryStartOdometer(entry)),
      endOdometer: stringifyValue(getEntryEndOdometer(entry)),
      purpose: getEntryPurpose(entry),
    });
  }

  function closeEditEntry() {
    setEditingEntry(null);
    setEditForm(blankEditForm);
    setEditError("");
    setEditSuccess("");
  }

  async function handleUpdateEntry(event) {
    event.preventDefault();

    if (!profile) {
      setEditError("Worker profile is missing.");
      return;
    }

    if (!editingEntry?.id) {
      setEditError("Mileage entry is missing.");
      return;
    }

    setSavingEdit(true);
    setEditError("");
    setEditSuccess("");

    try {
      const selectedProperty = properties.find(
        (property) => property.property_code === editForm.propertyCode
      );

      if (!selectedProperty) {
        throw new Error("Please select a property from the suggestions.");
      }

      const updatePayload = buildWorkerMileageEntryUpdatePayload({
        entry: editingEntry,
        form: editForm,
        property: selectedProperty,
      });

      const updatedEntry = await updateMileageEntryRow(
        editingEntry.id,
        updatePayload
      );

      await refreshAllWorkerData(profile.id);

      const updatedDate =
        getEntryDate(updatedEntry) ||
        editForm.entryDate ||
        getEntryDate(editingEntry);

      if (updatedDate) {
        setSelectedMonth(getMonthKeyFromDate(updatedDate));
      }

      setEditSuccess("Mileage entry updated successfully.");

      setTimeout(() => {
        closeEditEntry();
      }, 700);
    } catch (error) {
      console.error(error);
      setEditError(error?.message || "Unable to update mileage entry.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteEntry(entryId) {
    if (!profile) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this mileage entry?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteMileageEntry(entryId);
      await refreshEntries(profile.id);
      setJobberTimesheets(
        await getWorkerJobberTimesheets(profile.email || user?.email || "")
      );
    } catch (error) {
      console.error(error);
      alert(error?.message || "Unable to delete mileage entry.");
    }
  }

  async function refreshMessages(workerId) {
    const freshMessages = await getWorkerMessages(workerId);
    setMessages(freshMessages);
    return freshMessages;
  }

  async function markAdminMessagesRead(workerId) {
    if (!workerId) return;

    const hasUnreadAdminMessages = messages.some((message) => {
      return message.sender_role === "admin" && message.is_read === false;
    });

    if (!hasUnreadAdminMessages) return;

    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("worker_id", workerId)
      .eq("sender_role", "admin")
      .eq("is_read", false);

    if (error) throw error;

    setMessages((currentMessages) =>
      currentMessages.map((message) => {
        if (message.sender_role === "admin") {
          return { ...message, is_read: true };
        }

        return message;
      })
    );
  }

  async function handleSendWorkerMessage(event) {
    event.preventDefault();

    if (!profile?.id) {
      setMessageError("Worker profile is missing.");
      return;
    }

    const cleanMessage = messageDraft.trim();

    if (!cleanMessage) {
      setMessageError("Please type a message before sending.");
      return;
    }

    setSendingMessage(true);
    setMessageError("");

    try {
      const { error } = await supabase.from("messages").insert({
        worker_id: profile.id,
        sender_id: profile.id,
        sender_role: "driver",
        body: cleanMessage,
      });

      if (error) throw error;

      setMessageDraft("");
      await refreshMessages(profile.id);
    } catch (error) {
      console.error(error);
      setMessageError(
        error?.message ||
          "Unable to send message. Please check the messages table RLS policies."
      );
    } finally {
      setSendingMessage(false);
    }
  }

  async function refreshPaperUploads(workerId) {
    const freshUploads = await getWorkerPaperSheetUploads(workerId);
    setPaperUploads(freshUploads);
    return freshUploads;
  }

  async function refreshPaperDraftEntries(workerId) {
    const freshDraftEntries = await getWorkerPaperSheetDraftEntries(workerId);
    setPaperDraftEntries(freshDraftEntries);
    return freshDraftEntries;
  }

  function handleSelectedPaperSheetFile(file) {
    setUploadError("");
    setUploadSuccess("");

    if (!file) {
      setUploadFile(null);
      return;
    }

    if (!isAllowedPaperSheetFile(file)) {
      setUploadFile(null);
      setUploadError("Please upload a JPG, PNG, WEBP, or PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadFile(null);
      setUploadError("File is too large. Maximum upload size is 10 MB.");
      return;
    }

    setUploadFile(file);
  }

  function handlePaperSheetFileChange(event) {
    handleSelectedPaperSheetFile(event.target.files?.[0] || null);
  }

  function handlePaperSheetFileDrop(event) {
    event.preventDefault();
    handleSelectedPaperSheetFile(event.dataTransfer.files?.[0] || null);
  }

  async function handleUploadPaperSheet(event) {
    event.preventDefault();

    if (!profile?.id) {
      setUploadError("Worker profile is missing.");
      return;
    }

    if (!uploadFile) {
      setUploadError("Please choose an image or PDF file to upload.");
      return;
    }

    if (!isAllowedPaperSheetFile(uploadFile)) {
      setUploadError("Please upload a JPG, PNG, WEBP, or PDF file.");
      return;
    }

    if (uploadFile.size > 10 * 1024 * 1024) {
      setUploadError("File is too large. Maximum upload size is 10 MB.");
      return;
    }

    setUploadingSheet(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const filePath =
        profile.id + "/" + Date.now() + "-" + sanitizeFileName(uploadFile.name);

      const { error: uploadStorageError } = await supabase.storage
        .from("paper-sheets")
        .upload(filePath, uploadFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: uploadFile.type || undefined,
        });

      if (uploadStorageError) throw uploadStorageError;

      const { error: insertError } = await supabase
        .from("paper_sheet_uploads")
        .insert({
          worker_id: profile.id,
          file_name: uploadFile.name,
          file_path: filePath,
          file_type: uploadFile.type || "",
          file_size: uploadFile.size || 0,
          month_key: uploadMonthKey,
          notes: uploadNotes.trim(),
          status: "uploaded",
        });

      if (insertError) throw insertError;

      await refreshPaperUploads(profile.id);

      setUploadFile(null);
      setUploadNotes("");
      setUploadMonthKey(getCurrentMonthKey());
      setUploadSuccess(
        "Paper mileage sheet uploaded successfully. Admin can now review it."
      );

      const fileInput = document.getElementById("paper-sheet-file-input");

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      console.error(error);
      setUploadError(
        formatPaperSheetUploadError(
          error,
          "Unable to upload paper sheet. Please check storage and RLS policies."
        )
      );
    } finally {
      setUploadingSheet(false);
    }
  }

  async function handleOpenPaperUpload(upload) {
    if (!upload?.file_path) {
      setUploadError("This upload is missing a file path.");
      return;
    }

    setUploadError("");

    try {
      const { data, error } = await supabase.storage
        .from("paper-sheets")
        .createSignedUrl(upload.file_path, 60 * 10);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error(error);
      setUploadError(
        error?.message ||
          "Unable to open uploaded file. Please check storage policies."
      );
    }
  }

  async function handleDeletePaperUpload(upload) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this uploaded paper sheet?"
    );

    if (!confirmed) return;

    setUploadError("");
    setUploadSuccess("");

    try {
      const { error: deleteFileError } = await supabase.storage
        .from("paper-sheets")
        .remove([upload.file_path]);

      if (deleteFileError) throw deleteFileError;

      const { error: deleteRowError } = await supabase
        .from("paper_sheet_uploads")
        .delete()
        .eq("id", upload.id);

      if (deleteRowError) throw deleteRowError;

      if (String(selectedPaperUploadId) === String(upload.id)) {
        setSelectedPaperUploadId("");
      }

      await refreshPaperUploads(profile.id);
      setUploadSuccess("Paper sheet upload deleted.");
    } catch (error) {
      console.error(error);
      setUploadError(error?.message || "Unable to delete upload.");
    }
  }

  async function handleConvertPaperUpload(upload) {
    if (!profile?.id) {
      setDraftError("Worker profile is missing.");
      return;
    }

    if (!upload?.id) {
      setDraftError("Upload is missing.");
      return;
    }

    setConvertingUploadId(upload.id);
    setDraftError("");
    setDraftSuccess("");

    try {
      await invokeSupabaseFunction("convert-paper-sheet", {
        body: {
          uploadId: upload.id,
        },
      });

      paperDraftHasUnsavedEditsRef.current = false;
      await Promise.all([
        refreshPaperUploads(profile.id),
        refreshPaperDraftEntries(profile.id),
      ]);

      setSelectedPaperUploadId(upload.id);
      setDraftSuccess(
        "AI scan finished. Please review and edit flagged draft rows before submitting."
      );
    } catch (error) {
      console.error(error);
      setDraftError(
        error?.message ||
          "AI scan failed. Please check the Edge Function logs."
      );
    } finally {
      setConvertingUploadId("");
    }
  }

  function updatePaperDraftEntry(draftId, field, value) {
    paperDraftHasUnsavedEditsRef.current = true;
    setPaperDraftEntries((currentRows) =>
      currentRows.map((row) => {
        const targetRow = currentRows.find((item) => {
          return String(item.id) === String(draftId);
        });
        const shouldApplyToRow =
          field === "vehicle"
            ? targetRow &&
              String(row.upload_id) === String(targetRow.upload_id)
            : String(row.id) === String(draftId);

        if (!shouldApplyToRow) {
          return row;
        }

        const cleanValue =
          field === "property_code" ? String(value || "").toUpperCase() : value;
        const nextRow = {
          ...row,
          [field]: cleanValue,
        };

        if (field === "vehicle") {
          nextRow.purpose = syncPurposeWithVehicleUnitPrefix(
            row.purpose,
            cleanValue
          );
        }

        if (field === "property_code") {
          const selectedProperty = findPropertyByCode(properties, cleanValue);

          if (selectedProperty) {
            nextRow.property_code = selectedProperty.property_code;
            nextRow.property_text =
              getPropertyAddressLabel(selectedProperty) ||
              getPropertyDisplayLabel(selectedProperty);
            nextRow.review_notes = removePropertyReviewNotes(nextRow.review_notes);
            nextRow.needs_review = Boolean(nextRow.review_notes);
          }
        }

        if (field === "start_odometer" || field === "end_odometer") {
          const start = Number(
            field === "start_odometer" ? cleanValue : nextRow.start_odometer
          );
          const end = Number(
            field === "end_odometer" ? cleanValue : nextRow.end_odometer
          );

          if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
            nextRow.miles = end - start;
          }
        }

        return nextRow;
      })
    );

    setDraftError("");
    setDraftSuccess("");
  }

  function handleAddPaperDraftRow(upload) {
    if (!profile?.id || !upload?.id) return;
    paperDraftHasUnsavedEditsRef.current = true;
    setSelectedPaperUploadId(upload.id);

    const uploadRows = getRenumberedPaperDraftRows(
      paperDraftEntries.filter((row) => {
        return String(row.upload_id) === String(upload.id);
      })
    );

    const lastRow = uploadRows[uploadRows.length - 1];

    const newRow = {
      id: "new-" + Date.now(),
      upload_id: upload.id,
      worker_id: profile.id,
      entry_number: uploadRows.length + 1,
      entry_date: "",
      vehicle: lastRow?.vehicle || "",
      property_text: "",
      property_code: "",
      start_odometer: "",
      end_odometer: "",
      miles: "",
      purpose: "",
      ai_confidence: null,
      needs_review: true,
      is_new: true,
    };

    setPaperDraftEntries((currentRows) =>
      renumberPaperDraftRowsForUpload([...currentRows, newRow], upload.id)
    );
  }

  async function handleDeletePaperDraftRow(row) {
    const confirmed = window.confirm("Delete this draft row?");

    if (!confirmed) return;

    setDraftError("");
    setDraftSuccess("");

    try {
      if (String(row.id).startsWith("new-")) {
        setPaperDraftEntries((currentRows) =>
          renumberPaperDraftRowsForUpload(
            currentRows.filter((item) => String(item.id) !== String(row.id)),
            row.upload_id
          )
        );
        return;
      }

      const { error } = await supabase
        .from("paper_sheet_draft_entries")
        .delete()
        .eq("id", row.id);

      if (error) throw error;

      setPaperDraftEntries((currentRows) =>
        renumberPaperDraftRowsForUpload(
          currentRows.filter((item) => String(item.id) !== String(row.id)),
          row.upload_id
        )
      );
      await renumberPaperDraftRowsInDatabase(row.upload_id, profile.id);
    } catch (error) {
      console.error(error);
      setDraftError(error?.message || "Unable to delete draft row.");
    }
  }

  async function handleSavePaperDraftRows(uploadId, rowsOverride = null) {
    if (!profile?.id) {
      setDraftError("Worker profile is missing.");
      return;
    }

    const rowsForUpload = getRenumberedPaperDraftRows(
      rowsOverride ||
        paperDraftEntries.filter((row) => {
          return String(row.upload_id) === String(uploadId);
        })
    );

    setSavingDraftUploadId(uploadId);
    setDraftError("");
    setDraftSuccess("");

    try {
      const existingRows = rowsForUpload.filter((row) => {
        return !String(row.id).startsWith("new-");
      });

      const newRows = rowsForUpload.filter((row) => {
        return String(row.id).startsWith("new-");
      });

      await Promise.all(
        existingRows.map((row) => {
          return supabase
            .from("paper_sheet_draft_entries")
            .update(buildDraftEntryPayload(row))
            .eq("id", row.id);
        })
      ).then((results) => {
        const failedResult = results.find((result) => result.error);

        if (failedResult?.error) {
          throw failedResult.error;
        }
      });

      if (newRows.length > 0) {
        const { error: insertError } = await supabase
          .from("paper_sheet_draft_entries")
          .insert(
            newRows.map((row) => ({
              ...buildDraftEntryPayload(row),
              upload_id: uploadId,
              worker_id: profile.id,
            }))
          );

        if (insertError) throw insertError;
      }

      paperDraftHasUnsavedEditsRef.current = false;
      await refreshPaperDraftEntries(profile.id);
      setDraftSuccess("Draft rows saved successfully.");
    } catch (error) {
      console.error(error);
      setDraftError(error?.message || "Unable to save draft rows.");
    } finally {
      setSavingDraftUploadId("");
    }
  }

  async function handleSubmitDraftEntries(upload) {
    if (!profile?.id) {
      setDraftError("Worker profile is missing.");
      return;
    }

    const rowsForUpload = getRenumberedPaperDraftRows(
      paperDraftEntries.filter((row) => {
        return String(row.upload_id) === String(upload.id);
      })
    );

    if (rowsForUpload.length === 0) {
      setDraftError("There are no draft rows to submit.");
      return;
    }

    const invalidRow = rowsForUpload.find((row) => {
      const selectedProperty = findPropertyByCode(properties, row.property_code);
      const selectedVehicle = findWorkerVehicleByDisplayName(
        vehicles,
        row.vehicle,
        profile
      );

      return (
        !row.entry_date ||
        !row.vehicle ||
        !selectedVehicle ||
        !row.property_code ||
        !selectedProperty ||
        row.start_odometer === "" ||
        row.start_odometer === null ||
        row.start_odometer === undefined ||
        row.end_odometer === "" ||
        row.end_odometer === null ||
        row.end_odometer === undefined ||
        row.miles === "" ||
        row.miles === null ||
        row.miles === undefined
      );
    });

    if (invalidRow) {
      setDraftError(
        "Please complete every draft row before submitting. Each row needs date, a vehicle from the dropdown, property code from the property list, start odo, end odo, and miles."
      );
      return;
    }

    const odometerPlan = buildPaperDraftOdometerPlan({
      rows: rowsForUpload,
      entries,
      vehicles,
      states: vehicleOdometerStates,
      profile,
    });
    const blockedOdometerRow = rowsForUpload.find((row) => {
      const plan = odometerPlan.get(String(row.id));
      return plan?.requiresOverride && !String(row.odometer_override_reason || "").trim();
    });

    if (blockedOdometerRow) {
      const plan = odometerPlan.get(String(blockedOdometerRow.id));
      setDraftError(
        `Entry #${blockedOdometerRow.entry_number || "?"} starts at ${blockedOdometerRow.start_odometer}, but ${plan.vehicleName} is already at ${plan.expectedStartOdometer}. Fix the start odometer or enter an override reason before submitting.`
      );
      return;
    }

    const blockedReviewRow = rowsForUpload.find((row) => {
      const reviewState = getPaperDraftRowReviewState({
        row,
        plan: odometerPlan.get(String(row.id)),
        properties,
      });

      return reviewState.blocksSubmit;
    });

    if (blockedReviewRow) {
      const reviewState = getPaperDraftRowReviewState({
        row: blockedReviewRow,
        plan: odometerPlan.get(String(blockedReviewRow.id)),
        properties,
      });

      setDraftError(
        `Entry #${blockedReviewRow.entry_number || "?"} needs review: ${reviewState.message}`
      );
      return;
    }

    const confirmed = window.confirm(
      "Submit these converted rows as final mileage entries?"
    );

    if (!confirmed) return;

    setSubmittingDraftUploadId(upload.id);
    setDraftError("");
    setDraftSuccess("");

    try {
      await handleSavePaperDraftRows(upload.id, rowsForUpload);

      for (const row of rowsForUpload) {
        const selectedProperty = findPropertyByCode(properties, row.property_code);
        const selectedVehicle = findWorkerVehicleByDisplayName(
          vehicles,
          row.vehicle,
          profile
        );
        const plan = odometerPlan.get(String(row.id));

        await saveWorkerMileageEntry({
          profile,
          entryDate: row.entry_date,
          vehicleName: row.vehicle,
          vehicleId: selectedVehicle?.id || selectedVehicle?.base_vehicle_id || "",
          propertyCode: selectedProperty.property_code,
          propertyDisplay:
            selectedProperty.display_label ||
            selectedProperty.display_name ||
            selectedProperty.property_code,
          startOdometer: row.start_odometer,
          endOdometer: row.end_odometer,
          expectedStartOdometer:
            plan?.expectedStartOdometer !== undefined
              ? plan.expectedStartOdometer
              : row.start_odometer,
          odometerOverrideReason: row.odometer_override_reason || "",
          purpose: row.purpose || "",
        });
      }

      const { error: uploadUpdateError } = await supabase
        .from("paper_sheet_uploads")
        .update({
          ai_status: "submitted",
          status: "converted",
        })
        .eq("id", upload.id);

      if (uploadUpdateError) throw uploadUpdateError;

      await Promise.all([
        refreshEntries(profile.id),
        refreshPaperUploads(profile.id),
        refreshPaperDraftEntries(profile.id),
      ]);

      setDraftSuccess(
        "Converted paper sheet rows were submitted as final mileage entries."
      );
      setActiveView("history");
    } catch (error) {
      console.error(error);
      setDraftError(
        error?.message ||
          "Unable to submit converted entries. Please review the draft rows."
      );
    } finally {
      setSubmittingDraftUploadId("");
    }
  }

  async function handleLogout() {
    await signOutUser();
    navigate("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="rounded-3xl bg-white px-8 py-6 shadow-sm ring-1 ring-slate-200">
          <p className="font-semibold text-slate-700">
            Loading worker dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef3f9]">
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <SidebarContent
            activeView={activeView}
            setActiveView={setActiveView}
            profile={profile}
            user={user}
            onLogout={handleLogout}
            badgeCounts={sidebarBadgeCounts}
          />
        </aside>

        <section className="min-w-0 flex-1 lg:pl-72">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-6 py-4 xl:px-10">
              <div className="flex items-center gap-4">
                <LogoCard
                  wrapperClassName="hidden rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 md:flex"
                  imageClassName="h-10 w-auto object-contain"
                  fallbackClassName="h-10 w-32"
                />

                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-blue-600">
                    Mileage Tracker
                  </p>
                  <h1 className="text-xl font-black text-slate-950 md:text-2xl">
                    {getPageTitle(activeView)}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  {monthOptions.map((monthKey) => (
                    <option key={monthKey} value={monthKey}>
                      {formatMonthKey(monthKey)}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1800px] px-6 py-8 xl:px-10">
            <MobileNav
              activeView={activeView}
              setActiveView={setActiveView}
              badgeCounts={sidebarBadgeCounts}
            />

            {dataError && (
              <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-800">
                {dataError}
              </div>
            )}

            {activeView === "overview" && (
              <OverviewView
                profile={profile}
                user={user}
                selectedMonth={selectedMonth}
                selectedMonthEntries={selectedMonthEntries}
                selectedMonthSummary={selectedMonthSummary}
                activeVehicle={activeVehicle}
                paperUploads={paperUploads}
                setActiveView={setActiveView}
              />
            )}

            {activeView === "new-entry" && (
              <NewEntryView
                form={form}
                updateForm={updateForm}
                vehicles={vehicles}
                properties={properties}
                jobberVisits={jobberVisits}
                selectedJobberVisit={selectedJobberVisit}
                setSelectedJobberVisit={setSelectedJobberVisit}
                calculatedMiles={calculatedMiles}
                savingEntry={savingEntry}
                formError={formError}
                formSuccess={formSuccess}
                onSave={handleSaveEntry}
                entryBatchRows={entryBatchRows}
                savingEntryBatch={savingEntryBatch}
                onAddBatchRow={handleAddEntryBatchRow}
                onUpdateBatchRow={updateEntryBatchRow}
                onDeleteBatchRow={deleteEntryBatchRow}
                onSubmitBatchRows={handleSubmitEntryBatchRows}
                profile={profile}
              />
            )}

            {activeView === "history" && (
              <HistoryView
                selectedMonth={selectedMonth}
                monthOptions={monthOptions}
                setSelectedMonth={setSelectedMonth}
                selectedMonthEntries={selectedMonthEntries}
                timesheetMap={timesheetMap}
                properties={properties}
                onDeleteEntry={handleDeleteEntry}
                onEditEntry={openEditEntry}
                editingEntry={editingEntry}
                editForm={editForm}
                updateEditForm={updateEditForm}
                closeEditEntry={closeEditEntry}
                handleUpdateEntry={handleUpdateEntry}
                savingEdit={savingEdit}
                editError={editError}
                editSuccess={editSuccess}
                editCalculatedMiles={editCalculatedMiles}
                vehicles={vehicles}
                properties={properties}
                profile={profile}
              />
            )}

            {activeView === "timesheets" && (
              <WorkerTimesheetsView
                selectedMonth={selectedMonth}
                monthOptions={monthOptions}
                setSelectedMonth={setSelectedMonth}
                timesheets={selectedMonthTimesheets}
                allTimesheets={jobberTimesheets}
                vehicles={vehicles}
                profile={profile}
                selectedTimesheet={selectedTimesheet}
                mileageForm={timesheetMileageForm}
                updateMileageForm={updateTimesheetMileageForm}
                openMileageForm={openTimesheetMileageForm}
                closeMileageForm={closeTimesheetMileageForm}
                onRemoveTimesheet={handleRemoveTimesheet}
                onSubmitMileage={handleCompleteTimesheetMileage}
                savingMileage={savingTimesheetMileage}
                deletingTimesheetId={deletingTimesheetId}
                error={timesheetError}
                success={timesheetSuccess}
                calculatedMiles={timesheetCalculatedMiles}
              />
            )}

            {activeView === "upload" && (
              <UploadSheetView
                profile={profile}
                uploads={paperUploads}
                uploadMonthKey={uploadMonthKey}
                setUploadMonthKey={setUploadMonthKey}
                uploadNotes={uploadNotes}
                setUploadNotes={setUploadNotes}
                uploadFile={uploadFile}
                onFileChange={handlePaperSheetFileChange}
                onFileDrop={handlePaperSheetFileDrop}
                onUpload={handleUploadPaperSheet}
                uploadingSheet={uploadingSheet}
                uploadError={uploadError}
                uploadSuccess={uploadSuccess}
                draftEntries={paperDraftEntries}
                selectedUploadId={selectedPaperUploadId}
                setSelectedUploadId={setSelectedPaperUploadId}
                properties={properties}
                vehicles={vehicles}
                entries={entries}
                vehicleOdometerStates={vehicleOdometerStates}
                convertingUploadId={convertingUploadId}
                savingDraftUploadId={savingDraftUploadId}
                submittingDraftUploadId={submittingDraftUploadId}
                draftError={draftError}
                draftSuccess={draftSuccess}
                onOpenUpload={handleOpenPaperUpload}
                onDeleteUpload={handleDeletePaperUpload}
                onConvertUpload={handleConvertPaperUpload}
                onUpdateDraftEntry={updatePaperDraftEntry}
                onAddDraftRow={handleAddPaperDraftRow}
                onDeleteDraftRow={handleDeletePaperDraftRow}
                onSaveDraftRows={handleSavePaperDraftRows}
                onSubmitDraftEntries={handleSubmitDraftEntries}
              />
            )}

            {activeView === "messages" && (
              <MessagesView
                profile={profile}
                messages={messages}
                messageDraft={messageDraft}
                setMessageDraft={setMessageDraft}
                sendingMessage={sendingMessage}
                messageError={messageError}
                onSendMessage={handleSendWorkerMessage}
              />
            )}

            {activeView === "help" && <HelpView />}
          </div>
        </section>
        <AIWorkerHelpBot
          setActiveView={setActiveView}
          activeView={activeView}
          profile={profile}
        />
      </div>
    </main>
  );
}


function AIWorkerHelpBot({ setActiveView, activeView, profile }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text:
        "Hi, my name is Johnny. I can help with mileage entries, Jobber timesheets, paper sheet scanning, reports, messages, route tools, or general questions.",
      actions: [
        { label: "Add Mileage", view: "new-entry" },
        { label: "Upload Sheet", view: "upload" },
        { label: "Message Admin", view: "messages" },
        { label: "Open Manual", url: WORKER_MANUAL_URL },
      ],
    },
  ]);

  const quickPrompts = [
    "Where do I submit mileage?",
    "How do I upload a paper sheet?",
    "Where can I review my records?",
    "How do I message admin?",
  ];

  function getBotReply(userText) {
    const text = String(userText || "").toLowerCase().trim();

    if (
      text === "hi" ||
      text === "hello" ||
      text === "hey" ||
      text === "good morning" ||
      text === "good afternoon" ||
      text === "good evening"
    ) {
      return {
        text:
          "Hey, I am doing good. Thanks for asking. What are we working on today? I can help with the app, or you can ask me a general question too.",
        actions: [
          { label: "Add Mileage", view: "new-entry" },
          { label: "Upload Sheet", view: "upload" },
          { label: "Message Admin", view: "messages" },
        ],
      };
    }

    if (
      text === "thanks" ||
      text === "thank you" ||
      text === "thankyou" ||
      text === "ty" ||
      text === "thank you!" ||
      text === "thanks!"
    ) {
      return {
        text:
          "You are welcome! Let me know if you need help finding anything in the Mileage Tracker.",
        actions: [
          { label: "View History", view: "history" },
          { label: "Message Admin", view: "messages" },
        ],
      };
    }

    if (
      text === "ok" ||
      text === "okay" ||
      text === "got it" ||
      text === "alright" ||
      text === "nice" ||
      text === "cool"
    ) {
      return {
        text:
          "Sounds good. I am here if you need help using any part of the app.",
        actions: [
          { label: "Add Mileage", view: "new-entry" },
          { label: "Upload Sheet", view: "upload" },
        ],
      };
    }

    if (
      text.includes("who are you") ||
      text.includes("what can you do") ||
      text.includes("what do you do")
    ) {
      return {
        text:
          "I am the Mileage Help Assistant. I can guide you around the app, explain where to submit mileage, upload paper sheets, review records, message admin, and use route tools.",
        actions: [
          { label: "Add Mileage", view: "new-entry" },
          { label: "Upload Sheet", view: "upload" },
          { label: "View History", view: "history" },
          { label: "Open Manual", url: WORKER_MANUAL_URL },
        ],
      };
    }

    if (
      text.includes("manual") ||
      text.includes("guide") ||
      text.includes("instructions") ||
      text.includes("step by step")
    ) {
      return {
        text:
          "Open the Mileage Tracker User Manual for step-by-step help with mileage entries, paper sheet uploads, history, messages, route tools, and support.",
        actions: [{ label: "Open Manual", url: WORKER_MANUAL_URL }],
      };
    }

    if (

      text.includes("submit") ||
      text.includes("entry") ||
      text.includes("entries") ||
      text.includes("mileage") ||
      text.includes("odometer") ||
      text.includes("add") ||
      text.includes("trip")
    ) {
      return {
        text:
          "Go to New Mileage Entry. Add the date, vehicle, property, start odometer, end odometer, and purpose. The app will calculate the miles, then you can save the entry.",
        actions: [{ label: "Go To New Mileage Entry", view: "new-entry" }],
      };
    }

    if (
      text.includes("upload") ||
      text.includes("paper") ||
      text.includes("sheet") ||
      text.includes("file") ||
      text.includes("document") ||
      text.includes("photo") ||
      text.includes("pdf") ||
      text.includes("picture")
    ) {
      return {
        text:
          "Go to Upload Paper Sheet. Choose your photo or PDF, select the mileage month, add notes if needed, and upload it. The AI scan can turn it into editable rows, and admin can still review the original file.",
        actions: [{ label: "Go To Upload Paper Sheet", view: "upload" }],
      };
    }

    if (
      text.includes("history") ||
      text.includes("records") ||
      text.includes("old") ||
      text.includes("past") ||
      text.includes("download") ||
      text.includes("csv") ||
      text.includes("edit") ||
      text.includes("delete")
    ) {
      return {
        text:
          "Go to Mileage History. You can review saved mileage records, edit corrections, delete mistakes, or download a CSV for the selected month.",
        actions: [{ label: "Go To Mileage History", view: "history" }],
      };
    }

    if (
      text.includes("admin") ||
      text.includes("message") ||
      text.includes("chat") ||
      text.includes("question") ||
      text.includes("correction") ||
      text.includes("help") ||
      text.includes("wrong")
    ) {
      return {
        text:
          "Go to Messages. You can ask admin about corrections, missing mileage, property questions, paper sheet uploads, or anything you need help reviewing.",
        actions: [{ label: "Go To Messages", view: "messages" }],
      };
    }

    if (
      text.includes("route") ||
      text.includes("map") ||
      text.includes("address") ||
      text.includes("location") ||
      text.includes("direction") ||
      text.includes("google")
    ) {
      return {
        text:
          "Go to Overview and use the Central Wisconsin Map Search card. Search a property address, city, or destination, then open it in Google Maps.",
        actions: [{ label: "Go To Overview", view: "overview" }],
      };
    }

    if (
      text.includes("password") ||
      text.includes("login") ||
      text.includes("sign in") ||
      text.includes("account")
    ) {
      return {
        text:
          "For password issues, use Forgot Password on the login page. If your worker profile or access looks wrong, send admin a message.",
        actions: [{ label: "Message Admin", view: "messages" }],
      };
    }

    if (
      text.includes("vehicle") ||
      text.includes("car") ||
      text.includes("van")
    ) {
      return {
        text:
          "Your available vehicle options appear inside New Mileage Entry. If the vehicle list looks wrong or a vehicle is missing, send admin a message.",
        actions: [
          { label: "Go To New Mileage Entry", view: "new-entry" },
          { label: "Message Admin", view: "messages" },
        ],
      };
    }

    if (
      text.includes("property") ||
      text.includes("code") ||
      text.includes("building")
    ) {
      return {
        text:
          "When adding mileage, choose or search the property in New Mileage Entry. If you cannot find the correct property or property code, message admin for help.",
        actions: [
          { label: "Go To New Mileage Entry", view: "new-entry" },
          { label: "Message Admin", view: "messages" },
        ],
      };
    }

    return {
      text:
        "I can help you find the right place in the app. You can add mileage, upload paper sheets, review history, message admin, or use the map search from Overview.",
      actions: [
        { label: "Add Mileage", view: "new-entry" },
        { label: "Upload Sheet", view: "upload" },
        { label: "Message Admin", view: "messages" },
        { label: "Open Manual", url: WORKER_MANUAL_URL },
      ],
    };
  }

  async function sendMessage(textOverride) {
    const cleanText = String(textOverride || draft).trim();

    if (!cleanText || isThinking) return;

    const fallbackReply = getBotReply(cleanText);

    setMessages((currentMessages) => [
      ...currentMessages,
      { sender: "user", text: cleanText },
    ]);

    setDraft("");
    setIsOpen(true);
    setIsThinking(true);

    try {
      const claudeReply = await askClaudeAssistant({
        message: cleanText,
        history: messages,
        role: "worker",
        activeView,
        profile,
      });

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          sender: "bot",
          text: claudeReply.text || fallbackReply.text,
          actions: fallbackReply.actions || [],
        },
      ]);
    } catch (error) {
      console.warn("Johnny assistant unavailable; using local fallback.", error);

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          sender: "bot",
          text: fallbackReply.text,
          actions: fallbackReply.actions || [],
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  function goToView(view) {
    setActiveView(view);
    setIsOpen(false);
  }

  function handleBotAction(action) {
    if (action?.url) {
      window.open(action.url, "_blank", "noopener,noreferrer");
      return;
    }

    goToView(action.view);
  }

  return (
    <JohnnyChatShell
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title="Johnny Assistant"
      launcherClassName="bg-blue-600 hover:bg-blue-700"
      closeAriaLabel="Close help assistant"
      sendArea={
        <div className="border-t border-slate-200 bg-white p-3">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={isThinking}
                placeholder="Ask Johnny for help..."
                className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />

              <button
                type="submit"
                disabled={!draft.trim() || isThinking}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Send help question"
              >
                <Send size={18} />
              </button>
            </form>
        </div>
      }
    >
      <div className="h-full space-y-3 overflow-y-auto bg-slate-50 p-4">
        {messages.map((message, index) => {
          const isUser = message.sender === "user";

          return (
            <div
              key={index}
              className={isUser ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  "max-w-[88%] rounded-3xl px-4 py-3 text-sm font-semibold leading-6 " +
                  (isUser
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-700 shadow-sm ring-1 ring-slate-200")
                }
              >
                <p>{message.text}</p>

                {!isUser && message.actions?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.actions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => handleBotAction(action)}
                        className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isThinking && (
          <div className="flex justify-start">
            <div className="max-w-[88%] rounded-3xl bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-500 shadow-sm ring-1 ring-slate-200">
              Johnny is thinking...
            </div>
          </div>
        )}
      </div>
    </JohnnyChatShell>
  );
}

function LogoCard({ wrapperClassName, imageClassName, fallbackClassName }) {
  const [logoIndex, setLogoIndex] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);

  function handleLogoError() {
    if (logoIndex < logoPaths.length - 1) {
      setLogoIndex((currentIndex) => currentIndex + 1);
      return;
    }

    setLogoFailed(true);
  }

  return (
    <div className={wrapperClassName}>
      {!logoFailed ? (
        <img
          src={logoPaths[logoIndex]}
          alt="Prosper Real Estate Logo"
          onError={handleLogoError}
          className={imageClassName}
        />
      ) : (
        <div
          className={`flex items-center justify-center rounded-2xl bg-blue-600 text-white ${fallbackClassName}`}
        >
          <Route size={24} />
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  activeView,
  setActiveView,
  profile,
  user,
  onLogout,
  badgeCounts = {},
}) {
  return (
    <>
      <div className="border-b border-slate-200 p-5">
        <div className="rounded-[2rem] bg-slate-50 p-4 ring-1 ring-slate-200">
          <LogoCard
            wrapperClassName="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
            imageClassName="h-16 w-full object-contain"
            fallbackClassName="h-16 w-full"
          />

          <div className="mt-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
              Worker Portal
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Mileage Tracker
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Track mileage, upload paper sheets, review history, check routes, and message admin.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
              <UserRound size={22} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">
                {profile?.full_name || "Worker"}
              </p>
              <p className="truncate text-xs font-semibold text-slate-500">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black capitalize text-blue-700">
            <BadgeCheck size={14} />
            {profile?.role || "worker"}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const badgeCount = Number(badgeCounts[item.id] || 0);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon size={19} />
                <span className="truncate">{item.label}</span>
              </span>

              {badgeCount > 0 && (
                <span
                  className={`ml-auto rounded-full px-2.5 py-1 text-xs font-black ${
                    isActive
                      ? "bg-white text-blue-700"
                      : "bg-red-500 text-white"
                  }`}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </>
  );
}

function MobileNav({ activeView, setActiveView, badgeCounts = {} }) {
  return (
    <div className="prosper-mobile-nav mb-6 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200 lg:hidden">
      <div className="mb-3 flex items-center justify-center rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <LogoCard
          wrapperClassName="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200"
          imageClassName="h-10 w-auto object-contain"
          fallbackClassName="h-10 w-24"
        />
      </div>

      <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500 sm:hidden">
        Choose Feature
      </label>
      <select
        value={activeView}
        onChange={(event) => setActiveView(event.target.value)}
        className="mb-3 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:hidden"
      >
        {navigationItems.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>

      <div className="hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-3">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const badgeCount = Number(badgeCounts[item.id] || 0);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`relative flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-black transition ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-slate-50 text-slate-600"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon size={16} />
                <span>{item.label}</span>
              </span>

              {badgeCount > 0 && (
                <span
                  className={`absolute right-1 top-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                    isActive
                      ? "bg-white text-blue-700"
                      : "bg-red-500 text-white"
                  }`}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OverviewView({
  profile,
  user,
  selectedMonth,
  selectedMonthEntries,
  selectedMonthSummary,
  activeVehicle,
  paperUploads = [],
  setActiveView,
}) {
  return (
    <div className="space-y-6">
      <section className="prosper-hero-gradient overflow-hidden rounded-[2rem] text-white shadow-xl">
        <div className="relative p-7 md:p-8">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-20 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-blue-100">
              <Sparkles size={16} />
              Live Dashboard Overview
            </div>

            <h2 className="max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
              Welcome, {profile?.full_name || user?.email}
            </h2>

            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Manage mileage entries, upload paper forms, check routes, and message admin from one polished dashboard. Updates sync live across worker and admin views.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <HeroMiniStat
                label="Selected Month"
                value={formatMonthKey(selectedMonth)}
                icon={<CalendarDays size={20} />}
              />

              <HeroMiniStat
                label="Role"
                value={profile?.role || "worker"}
                icon={<BadgeCheck size={20} />}
              />

              <HeroMiniStat
                label="Latest Vehicle"
                value={activeVehicle}
                icon={<Car size={20} />}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-3">
        <KpiCard
          icon={<ClipboardList size={24} />}
          label="Total Entries"
          value={selectedMonthSummary.totalEntries}
          helper={formatMonthKey(selectedMonth)}
          accent="blue"
        />

        <KpiCard
          icon={<Gauge size={24} />}
          label="Total Miles"
          value={formatMiles(selectedMonthSummary.totalMiles)}
          helper={formatMonthKey(selectedMonth)}
          accent="emerald"
        />

        <KpiCard
          icon={<FileUp size={24} />}
          label="Paper Uploads"
          value={String(paperUploads.length)}
          helper="Uploaded paper sheets"
          accent="violet"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <SectionTitle
            eyebrow="Quick Actions"
            title="Choose Your Next Step"
            text="Add mileage, upload a paper sheet, review saved entries, or message admin without leaving the dashboard."
          />

          <ManualOverviewCard />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <QuickActionCard
              icon={<Plus size={24} />}
              title="Add Mileage"
              text="Create a new daily mileage entry."
              onClick={() => setActiveView("new-entry")}
            />

            <QuickActionCard
              icon={<FileUp size={24} />}
              title="Upload Sheet"
              text="Upload a paper form for admin review."
              onClick={() => setActiveView("upload")}
            />

            <QuickActionCard
              icon={<History size={24} />}
              title="View History"
              text="Review past saved mileage records."
              onClick={() => setActiveView("history")}
            />

            <QuickActionCard
              icon={<MessageCircle size={24} />}
              title="Message Admin"
              text="Ask a question or request help."
              onClick={() => setActiveView("messages")}
            />
          </div>
        </section>

        <RouteToolsCard />

        <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <SectionTitle
            eyebrow="Recent Mileage"
            title={formatMonthKey(selectedMonth)}
          />

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
            <MileageTable
              entries={selectedMonthEntries.slice(0, 5)}
              compact
              profile={profile}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function ManualOverviewCard() {
  return (
    <div className="mt-6 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm ring-1 ring-blue-50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <BookOpen size={24} />
          </div>

          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-950">User Manual</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Learn how to log mileage, upload paper sheets, review history,
              message admin, and use the help tools.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            window.open(WORKER_MANUAL_URL, "_blank", "noopener,noreferrer")
          }
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
        >
          <ExternalLink size={17} />
          Open Manual
        </button>
      </div>
    </div>
  );
}

function RouteToolsCard() {
  const [mapSearch, setMapSearch] = useState("");

  function openMapSearch(event) {
    event.preventDefault();

    const query = mapSearch.trim() || "Eau Claire WI";
    const mapsUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(query);

    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="prosper-glass-card overflow-hidden rounded-[2rem]">
      <div className="prosper-map-grid relative p-6">
        <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-blue-400/20 blur-2xl" />
        <div className="absolute bottom-0 left-8 h-24 w-24 rounded-full bg-emerald-400/20 blur-2xl" />

        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
            <MapPin size={14} />
            Route Tools
          </div>

          <h3 className="text-xl font-black text-slate-950">
            Central Wisconsin Map Search
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Search a property address, city, or destination before starting a
            trip. Results open in Google Maps in a new tab.
          </p>

          <form onSubmit={openMapSearch} className="mt-5 flex gap-2">
            <input
              type="text"
              value={mapSearch}
              onChange={(event) => setMapSearch(event.target.value)}
              placeholder="Search address, city, or property..."
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#2f8fc8] px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-[#1f6f9f]"
            >
              <Route size={17} />
              Open
            </button>
          </form>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <MapShortcut label="Eau Claire" query="Eau Claire WI" />
            <MapShortcut label="Wausau" query="Wausau WI" />
            <MapShortcut label="Chippewa Falls" query="Chippewa Falls WI" />
          </div>
        </div>
      </div>
    </section>
  );
}

function MapShortcut({ label, query }) {
  function openShortcut() {
    const mapsUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(query);

    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={openShortcut}
      className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
    >
      {label}
    </button>
  );
}

function NewEntryView({
  form,
  updateForm,
  vehicles,
  properties,
  jobberVisits,
  selectedJobberVisit,
  setSelectedJobberVisit,
  calculatedMiles,
  savingEntry,
  formError,
  formSuccess,
  onSave,
  entryBatchRows,
  savingEntryBatch,
  onAddBatchRow,
  onUpdateBatchRow,
  onDeleteBatchRow,
  onSubmitBatchRows,
  profile,
}) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 md:flex-row md:items-start">
        <SectionTitle
          eyebrow="New Entry"
          title="Add Mileage"
          text="Fill out the trip details below. Odometer numbers are grouped together so you can quickly review the mileage before saving."
          titleClassName="text-3xl"
        />

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Plus size={24} />
        </div>
      </div>

      <form onSubmit={onSave} className="mt-6 space-y-6">
        <FormSection
          title="Trip Details"
          description="Choose the date, vehicle, property, and reason for the trip."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <FormField label="Date">
              <input
                type="date"
                required
                value={form.entryDate}
                onChange={(event) =>
                  updateForm("entryDate", event.target.value)
                }
                className={inputClass}
              />
            </FormField>

            <FormField label="Vehicle">
              <select
                required
                value={form.vehicleId}
                onChange={(event) =>
                  updateForm("vehicleId", event.target.value)
                }
                className={inputClass}
              >
                <option value="">Select Vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {getWorkerVehicleDisplayName(vehicle, profile)}
                  </option>
                ))}
                <option value={OTHER_COMPANY_VEHICLE_ID}>
                  Other company vehicle
                </option>
              </select>
            </FormField>

            {form.vehicleId === OTHER_COMPANY_VEHICLE_ID && (
              <FormField label="Other Vehicle Name">
                <input
                  type="text"
                  required
                  value={form.customVehicleName}
                  onChange={(event) =>
                    updateForm("customVehicleName", event.target.value)
                  }
                  placeholder="Enter the exact vehicle name"
                  className={inputClass}
                />
              </FormField>
            )}

            <JobberVisitPicker
              jobberVisits={jobberVisits}
              selectedJobberVisit={selectedJobberVisit}
              setSelectedJobberVisit={setSelectedJobberVisit}
              updateForm={updateForm}
            />
            {selectedJobberVisit ? (
              <div className="xl:col-span-2 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-black text-blue-950">
                  Property Assigned From Jobber Visit
                </p>
                <p className="mt-1 text-sm font-semibold text-blue-800">
                  {selectedJobberVisit.jobberPropertyAddress ||
                    "Jobber property selected"}
                </p>
                <p className="mt-1 text-xs font-semibold text-blue-700">
                  You do not need to select a separate property when using a Jobber Visit.
                </p>
              </div>
            ) : (
              <PropertyAutocomplete
                properties={properties}
                selectedPropertyCode={form.propertyCode}
                onSelect={(propertyCode) => updateForm("propertyCode", propertyCode)}
              />
            )}

            <div className="xl:col-span-2">
              <FormField label="Purpose">
                <textarea
                  rows="4"
                  value={form.purpose}
                  onChange={(event) =>
                    updateForm("purpose", event.target.value)
                  }
                  placeholder="Inspection, maintenance, showing, office errand..."
                  className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </FormField>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Odometer Details"
          description="Company vehicles use the shared current odometer. If the start value is different, add an override reason before saving."
        >
          <OdometerContinuityNotice
            form={form}
            onReasonChange={(value) =>
              updateForm("odometerOverrideReason", value)
            }
          />

          <div className="grid gap-4 xl:grid-cols-3">
            <OdometerInput
              label="Start Odo"
              value={form.startOdometer}
              onChange={(value) => updateForm("startOdometer", value)}
              helper="Editable if personal travel happened."
            />

            <OdometerInput
              label="End Odo"
              value={form.endOdometer}
              onChange={(value) => updateForm("endOdometer", value)}
              helper="Enter the final odometer reading."
            />

            <TotalMilesCard calculatedMiles={calculatedMiles} />
          </div>
        </FormSection>

        {formError && <AlertBox type="error" message={formError} />}
        {formSuccess && <AlertBox type="success" message={formSuccess} />}

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onAddBatchRow}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-8 py-3 font-black text-blue-700 transition hover:bg-blue-100 md:w-auto"
          >
            <Plus size={19} />
            Add Row
          </button>

          {entryBatchRows.length > 0 && (
            <button
              type="button"
              disabled={savingEntryBatch}
              onClick={onSubmitBatchRows}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3 font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
            >
              <Save size={19} />
              {savingEntryBatch
                ? "Submitting Rows..."
                : `Submit ${entryBatchRows.length} Rows`}
            </button>
          )}

          <button
            type="submit"
            disabled={savingEntry}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-3 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
          >
            <Save size={19} />
            {savingEntry ? "Saving Entry..." : "Save Entry"}
          </button>
        </div>
      </form>

      <EntryBatchRowsTable
        rows={entryBatchRows}
        properties={properties}
        vehicles={vehicles}
        profile={profile}
        onUpdateRow={onUpdateBatchRow}
        onDeleteRow={onDeleteBatchRow}
      />
    </section>
  );
}

function EntryBatchRowsTable({
  rows,
  properties,
  vehicles,
  profile,
  onUpdateRow,
  onDeleteRow,
}) {
  if (!rows.length) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
        <h3 className="font-black text-slate-950">Rows Ready To Submit</h3>
        <p className="mt-1 text-sm text-slate-500">
          Edit any row before submitting the batch.
        </p>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <TableHeader>#</TableHeader>
              <TableHeader>Date</TableHeader>
              <TableHeader>Vehicle</TableHeader>
              <TableHeader>Property Code</TableHeader>
              <TableHeader>Start Odo</TableHeader>
              <TableHeader>Ending Odo</TableHeader>
              <TableHeader>Miles</TableHeader>
              <TableHeader>Purpose</TableHeader>
              <TableHeader>Action</TableHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td className="px-4 py-4 font-black text-slate-950">
                  {index + 1}
                </td>
                <td className="px-4 py-4">
                  <input
                    type="date"
                    value={row.entryDate || ""}
                    onChange={(event) =>
                      onUpdateRow(row.id, "entryDate", event.target.value)
                    }
                    className="w-40 rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </td>
                <td className="px-4 py-4">
                  <select
                    value={row.vehicleName || ""}
                    onChange={(event) =>
                      onUpdateRow(row.id, "vehicleName", event.target.value)
                    }
                    className="w-56 rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Select vehicle</option>
                    {vehicles.map((vehicle) => {
                      const vehicleName = getWorkerVehicleDisplayName(
                        vehicle,
                        profile
                      );
                      return (
                        <option key={vehicle.id} value={vehicleName}>
                          {vehicleName}
                        </option>
                      );
                    })}
                  </select>
                </td>
                <td className="px-4 py-4">
                  <PropertyCodeInput
                    value={row.propertyCode || ""}
                    properties={properties}
                    onChange={(value) =>
                      onUpdateRow(row.id, "propertyCode", value)
                    }
                    className="w-44"
                  />
                  {row.jobberVisit && (
                    <p className="mt-1 text-xs font-black text-blue-600">
                      Jobber
                    </p>
                  )}
                </td>
                <td className="px-4 py-4">
                  <input
                    type="number"
                    value={row.startOdometer ?? ""}
                    onChange={(event) =>
                      onUpdateRow(row.id, "startOdometer", event.target.value)
                    }
                    className="w-32 rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </td>
                <td className="px-4 py-4">
                  <input
                    type="number"
                    value={row.endOdometer ?? ""}
                    onChange={(event) =>
                      onUpdateRow(row.id, "endOdometer", event.target.value)
                    }
                    className="w-32 rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </td>
                <td className="px-4 py-4 font-black text-slate-950">
                  {formatMiles(
                    calculateMilesFromOdometer(row.startOdometer, row.endOdometer)
                  )}
                </td>
                <td className="px-4 py-4">
                  <textarea
                    rows="2"
                    value={row.purpose || ""}
                    onChange={(event) =>
                      onUpdateRow(row.id, "purpose", event.target.value)
                    }
                    className="w-64 resize-none rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </td>
                <td className="px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onDeleteRow(row.id)}
                    className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditMileageEntryPanel({
  editForm,
  updateEditForm,
  closeEditEntry,
  handleUpdateEntry,
  savingEdit,
  editError,
  editSuccess,
  editCalculatedMiles,
  vehicles,
  properties,
  profile,
}) {
  return (
    <div className="mt-6 rounded-[2rem] border border-blue-200 bg-blue-50/50 p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <SectionTitle
          eyebrow="Edit Entry"
          title="Correct Mileage Entry"
          text="Make the correction below, then save the updated entry."
        />

        <button
          type="button"
          onClick={closeEditEntry}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleUpdateEntry} className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-2">
          <FormField label="Date">
            <input
              type="date"
              required
              value={editForm.entryDate}
              onChange={(event) =>
                updateEditForm("entryDate", event.target.value)
              }
              className={inputClass}
            />
          </FormField>

          <FormField label="Vehicle">
            <select
              required
              value={editForm.vehicleName}
              onChange={(event) =>
                updateEditForm("vehicleName", event.target.value)
              }
              className={inputClass}
            >
              <option value="">Select Vehicle</option>
              {vehicles.map((vehicle) => {
                const vehicleName = getWorkerVehicleDisplayName(
                  vehicle,
                  profile
                );

                return (
                  <option key={vehicle.id} value={vehicleName}>
                    {vehicleName}
                  </option>
                );
              })}
            </select>
          </FormField>

          <PropertyAutocomplete
            properties={properties}
            selectedPropertyCode={editForm.propertyCode}
            onSelect={(propertyCode) =>
              updateEditForm("propertyCode", propertyCode)
            }
          />

          <div className="xl:col-span-2">
            <FormField label="Purpose">
              <textarea
                rows="4"
                value={editForm.purpose}
                onChange={(event) =>
                  updateEditForm("purpose", event.target.value)
                }
                placeholder="Inspection, maintenance, showing, office errand..."
                className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </FormField>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <OdometerInput
            label="Start Odo"
            value={editForm.startOdometer}
            onChange={(value) => updateEditForm("startOdometer", value)}
            helper="Editable for correction."
          />

          <OdometerInput
            label="End Odo"
            value={editForm.endOdometer}
            onChange={(value) => updateEditForm("endOdometer", value)}
            helper="Update the final odometer."
          />

          <TotalMilesCard calculatedMiles={editCalculatedMiles} />
        </div>

        {editError && <AlertBox type="error" message={editError} />}
        {editSuccess && <AlertBox type="success" message={editSuccess} />}

        <div className="flex flex-col gap-3 border-t border-blue-100 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={closeEditEntry}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={savingEdit}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={17} />
            {savingEdit ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormSection({ title, description, children }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
      <div className="mb-5">
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>

      {children}
    </div>
  );
}

function OdometerContinuityNotice({ form, onReasonChange }) {
  if (!form?.usesSharedVehicleOdometer) {
    return null;
  }

  const needsOverride = requiresOdometerOverride({
    isSharedVehicle: form.usesSharedVehicleOdometer,
    startOdometer: form.startOdometer,
    expectedStartOdometer: form.expectedStartOdometer,
  });

  return (
    <div
      className={`mb-4 rounded-2xl border p-4 ${
        needsOverride
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <p
        className={`text-sm font-black ${
          needsOverride ? "text-amber-900" : "text-emerald-900"
        }`}
      >
        Shared vehicle odometer: {form.expectedStartOdometer || "0"}
      </p>
      <p
        className={`mt-1 text-xs font-semibold ${
          needsOverride ? "text-amber-800" : "text-emerald-800"
        }`}
      >
        {needsOverride
          ? "The start odometer is different from the shared company vehicle reading. Add the reason before saving."
          : "Start odometer matches the shared company vehicle reading."}
      </p>

      {needsOverride && (
        <textarea
          rows="2"
          required
          value={form.odometerOverrideReason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Why is the start odometer different?"
          className="mt-3 w-full resize-none rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
        />
      )}
    </div>
  );
}

function OdometerInput({ label, value, onChange, helper }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">
          {label}
        </span>

        <input
          type="number"
          required
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
          className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-2xl font-black text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        {helper}
      </p>
    </div>
  );
}

function TotalMilesCard({ calculatedMiles }) {
  return (
    <div className="rounded-3xl bg-slate-950 p-4 text-white shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-blue-200">Total Miles</p>
          <p className="mt-2 text-4xl font-black tracking-tight">
            {formatMiles(calculatedMiles)}
          </p>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-blue-100">
          <Route size={24} />
        </div>
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-slate-300">
        Automatically calculated from End Odo minus Start Odo.
      </p>
    </div>
  );
}

function PropertyCodeInput({
  value,
  onChange,
  properties,
  disabled = false,
  placeholder = "Code",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const cleanQuery = String(value || "").trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!cleanQuery) return [];

    return (properties || [])
      .filter((property) => {
        const searchText = [
          property.property_code,
          formatPropertyCodeForDisplay(property.property_code),
          property.house_number,
          property.street_name,
          property.street_type,
          property.city,
          isProsperOfficeProperty(property)
            ? "prosper office miscellaneous bank trulock errands"
            : "",
          getPropertyDisplayLabel(property),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(cleanQuery);
      })
      .slice(0, 6);
  }, [properties, cleanQuery]);

  function handleChange(event) {
    const nextValue = String(event.target.value || "").toUpperCase();
    onChange(nextValue);
    setIsOpen(Boolean(nextValue.trim()));
  }

  function selectProperty(property) {
    onChange(property.property_code || "");
    setIsOpen(false);
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={handleChange}
        onFocus={() => {
          if (cleanQuery) setIsOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold uppercase outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      />

      {isOpen && cleanQuery && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-64 w-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          {suggestions.length > 0 ? (
            suggestions.map((property) => (
              <button
                key={property.id || property.property_code}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectProperty(property)}
                className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-blue-50"
              >
                <p className="text-sm font-black text-slate-950">
                  {formatPropertyCodeForDisplay(property.property_code)}
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  {getPropertyAddressLabel(property) ||
                    getPropertyDisplayLabel(property)}
                </p>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-xs font-semibold text-slate-500">
              No matching property code.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PropertyAutocomplete({ properties, selectedPropertyCode, onSelect }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedProperty = useMemo(() => {
    return properties.find(
      (property) => property.property_code === selectedPropertyCode
    );
  }, [properties, selectedPropertyCode]);

  useEffect(() => {
    if (selectedProperty) {
      // Keep the visible search text in sync when a saved property code is loaded.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(getPropertyDisplayLabel(selectedProperty));
    }

    if (!selectedPropertyCode) {
      setQuery("");
    }
  }, [selectedProperty, selectedPropertyCode]);

  const filteredProperties = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) {
      return [];
    }

    return properties
      .filter((property) => {
        const searchText = [
          property.property_code,
          formatPropertyCodeForDisplay(property.property_code),
          property.house_number,
          property.street_name,
          property.street_type,
          property.city,
          property.zip_code,
          property.display_name,
          property.display_label,
          isProsperOfficeProperty(property)
            ? "prosper office miscellaneous bank trulock errands"
            : "",
          getPropertyDisplayLabel(property),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(cleanQuery);
      })
      .slice(0, 8);
  }, [properties, query]);

  function handleInputChange(event) {
    const value = event.target.value;

    setQuery(value);
    setIsOpen(Boolean(value.trim()));

    if (selectedProperty && value !== getPropertyDisplayLabel(selectedProperty)) {
      onSelect("");
    }
  }

  function handleSelectProperty(property) {
    setQuery(getPropertyDisplayLabel(property));
    setIsOpen(false);
    onSelect(property.property_code);
  }

  return (
    <div className="relative xl:col-span-2">
      <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="text-sm font-black text-amber-900">
          Prosper Office Mileage Note
        </p>
        <p className="mt-1 text-sm leading-6 text-amber-800">
          For miscellaneous office trips such as the bank, Trulock, or other
          Prosper errands, select <span className="font-black">PROSPER</span>{" "}
          as the property.
        </p>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">
          Property
        </span>

        <div className="flex h-12 items-center rounded-2xl border border-slate-300 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
          <Search size={20} className="text-slate-400" />

          <input
            type="text"
            required
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (!selectedPropertyCode && query.trim()) setIsOpen(true);
            }}
            placeholder="Search by property code, street, house number, or city..."
            className="w-full border-0 bg-transparent px-3 text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      </label>

      {selectedPropertyCode && selectedProperty && (
        <div className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
          Selected: {formatPropertyCodeForDisplay(selectedProperty.property_code)}
        </div>
      )}

      {isOpen && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl">
          {filteredProperties.length > 0 ? (
            filteredProperties.map((property) => (
              <button
                key={property.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelectProperty(property)}
                className="w-full rounded-2xl px-4 py-3 text-left transition hover:bg-blue-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black text-slate-950">
                      {formatPropertyCodeForDisplay(property.property_code)}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      {getPropertyDisplayLabel(property)}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    {property.city || "Property"}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="font-black text-slate-950">No Property Found</p>
              <p className="mt-2 text-sm text-slate-500">
                Try searching by property code, street name, city, or house
                number.
              </p>
            </div>
          )}
        </div>
      )}

      {isOpen && query.trim() && (
        <button
          type="button"
          aria-label="Close property suggestions"
          className="fixed inset-0 z-30 cursor-default bg-transparent"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

function WorkerTimesheetsView({
  selectedMonth,
  monthOptions,
  setSelectedMonth,
  timesheets,
  allTimesheets,
  vehicles,
  profile,
  selectedTimesheet,
  mileageForm,
  updateMileageForm,
  openMileageForm,
  closeMileageForm,
  onRemoveTimesheet,
  onSubmitMileage,
  savingMileage,
  deletingTimesheetId,
  error,
  success,
  calculatedMiles,
}) {
  const completedCount = (allTimesheets || []).filter(isTimesheetMileageCompleted).length;
  const needsMileageCount = Math.max((allTimesheets || []).length - completedCount, 0);

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 xl:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <SectionTitle
            eyebrow="Jobber Timesheets"
            title="Complete Mileage From Timesheets"
            text="Review synced Jobber time records, then add odometer mileage for the timesheets that involved driving."
          />

          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {monthOptions.map((monthKey) => (
              <option key={monthKey} value={monthKey}>
                {formatMonthKey(monthKey)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <KpiCard
            icon={<CalendarDays size={24} />}
            label="Synced Timesheets"
            value={(allTimesheets || []).length}
            helper="From Jobber"
          />
          <KpiCard
            icon={<Gauge size={24} />}
            label="Needs Mileage"
            value={needsMileageCount}
            helper="Not completed yet"
          />
          <KpiCard
            icon={<BadgeCheck size={24} />}
            label="Completed"
            value={completedCount}
            helper="Linked to mileage"
          />
        </div>

        {!selectedTimesheet && error && (
          <div className="mt-4">
            <AlertBox type="error" message={error} />
          </div>
        )}
        {!selectedTimesheet && success && (
          <div className="mt-4">
            <AlertBox type="success" message={success} />
          </div>
        )}

        {selectedTimesheet && (
          <form
            onSubmit={onSubmitMileage}
            className="mt-6 rounded-[1.5rem] border border-blue-100 bg-blue-50/70 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <SectionTitle
                eyebrow="Complete Mileage"
                title={getTimesheetDisplayTitle(selectedTimesheet)}
                text={`${formatTimesheetDate(selectedTimesheet.start_at)} ${formatTimesheetTime(
                  selectedTimesheet.start_at
                )} - ${formatTimesheetTime(selectedTimesheet.end_at)}`}
              />

              <button
                type="button"
                onClick={closeMileageForm}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <FormField label="Vehicle">
                <select
                  required
                  value={mileageForm.vehicleId}
                  onChange={(event) => updateMileageForm("vehicleId", event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {getWorkerVehicleDisplayName(vehicle, profile)}
                    </option>
                  ))}
                  <option value={OTHER_COMPANY_VEHICLE_ID}>
                    Other company vehicle
                  </option>
                </select>
              </FormField>

              {mileageForm.vehicleId === OTHER_COMPANY_VEHICLE_ID && (
                <FormField label="Other Vehicle Name">
                  <input
                    type="text"
                    required
                    value={mileageForm.customVehicleName}
                    onChange={(event) =>
                      updateMileageForm("customVehicleName", event.target.value)
                    }
                    placeholder="Enter the exact vehicle name"
                    className={inputClass}
                  />
                </FormField>
              )}

              <OdometerInput
                label="Start Odo"
                value={mileageForm.startOdometer}
                onChange={(value) => updateMileageForm("startOdometer", value)}
                helper="Required before saving."
              />

              <OdometerInput
                label="End Odo"
                value={mileageForm.endOdometer}
                onChange={(value) => updateMileageForm("endOdometer", value)}
                helper="Required before saving."
              />
            </div>

            <OdometerContinuityNotice
              form={mileageForm}
              onReasonChange={(value) =>
                updateMileageForm("odometerOverrideReason", value)
              }
            />

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
              <FormField label="Purpose / Mileage Note">
                <textarea
                  rows="4"
                  value={mileageForm.purpose}
                  onChange={(event) => updateMileageForm("purpose", event.target.value)}
                  placeholder="Mileage note for this Jobber timesheet..."
                  className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </FormField>

              <TotalMilesCard calculatedMiles={calculatedMiles} />
            </div>

            {error && <div className="mt-4"><AlertBox type="error" message={error} /></div>}
            {success && <div className="mt-4"><AlertBox type="success" message={success} /></div>}

            <div className="mt-5 flex justify-end border-t border-blue-100 pt-5">
              <button
                type="submit"
                disabled={savingMileage}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-3 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
              >
                <Save size={19} />
                {savingMileage ? "Saving Mileage..." : "Save Timesheet Mileage"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {timesheets.length > 0 ? (
            timesheets.map((timesheet) => (
              <TimesheetCard
                key={timesheet.id}
                timesheet={timesheet}
                onAddMileage={openMileageForm}
                onRemoveTimesheet={onRemoveTimesheet}
                isRemoving={String(deletingTimesheetId) === String(timesheet.id)}
              />
            ))
          ) : (
            <div className="xl:col-span-2">
              <EmptyState
                title="No Timesheets Found"
                text="No synced Jobber timesheets were found for this month."
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TimesheetCard({
  timesheet,
  onAddMileage,
  onRemoveTimesheet,
  isRemoving = false,
}) {
  const completed = isTimesheetMileageCompleted(timesheet);
  const jobberJobUrl = getJobberJobUrl({}, timesheet);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TimesheetStatusBadge status={getTimesheetMileageStatus(timesheet)} />
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {timesheet.label || "Timesheet"}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-black text-slate-950">
            {getTimesheetDisplayTitle(timesheet)}
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {formatTimesheetDate(timesheet.start_at)} - {formatTimesheetTime(timesheet.start_at)} to {formatTimesheetTime(timesheet.end_at)} - {formatTimesheetDuration(timesheet.duration_minutes)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => onAddMileage(timesheet)}
            disabled={completed || isRemoving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
            <Route size={16} />
            {completed ? "Completed" : "Add Mileage"}
          </button>

          <button
            type="button"
            onClick={() => onRemoveTimesheet(timesheet)}
            disabled={isRemoving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={16} />
            {isRemoving ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>

      {timesheet.note && (
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          {timesheet.note}
        </p>
      )}

      {isActiveJob(timesheet) && (
        <div className="mt-4 grid gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-950 md:grid-cols-2">
          <InfoLine label="Job" value={timesheet.jobber_job_title || "Active Job"} />
          <InfoLine label="Job #" value={timesheet.jobber_job_number || "-"} />
          <InfoLine label="Client" value={timesheet.jobber_client_name || "No client"} />
          <InfoLine
            label="Address"
            value={timesheet.jobber_property_address || "No address"}
          />
          {jobberJobUrl && (
            <a
              href={jobberJobUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-black text-blue-700 hover:text-blue-900 md:col-span-2"
            >
              Open Jobber Job
              <ExternalLink size={15} />
            </a>
          )}
        </div>
      )}
    </article>
  );
}

function TimesheetStatusBadge({ status }) {
  const cleanStatus = String(status || "needs_review").toLowerCase();
  const isCompleted = cleanStatus === "completed";

  return (
    <span
      className={
        "inline-flex rounded-full px-3 py-1 text-xs font-black capitalize " +
        (isCompleted
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700")
      }
    >
      {isCompleted ? "Completed" : "Needs Review"}
    </span>
  );
}

function InfoLine({ label, value }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-blue-700">
        {label}
      </p>
      <p className="mt-1 font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function HistoryView({
  selectedMonth,
  monthOptions,
  setSelectedMonth,
  selectedMonthEntries,
  timesheetMap,
  properties,
  onDeleteEntry,
  onEditEntry,
  editingEntry,
  editForm,
  updateEditForm,
  closeEditEntry,
  handleUpdateEntry,
  savingEdit,
  editError,
  editSuccess,
  editCalculatedMiles,
  vehicles,
  profile,
}) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 xl:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <SectionTitle
          eyebrow="History"
          title="Mileage History"
          text="Review saved mileage entries, see the travel purpose, edit corrections, or download the selected month as a spreadsheet-compatible CSV file."
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            {monthOptions.map((monthKey) => (
              <option key={monthKey} value={monthKey}>
                {formatMonthKey(monthKey)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() =>
              downloadMileageHistoryCsv(
                selectedMonthEntries,
                selectedMonth,
                profile,
                timesheetMap,
                properties
              )
            }
            disabled={!selectedMonthEntries || selectedMonthEntries.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={17} />
            Download CSV
          </button>
        </div>
      </div>

      {editingEntry && (
        <EditMileageEntryPanel
          editForm={editForm}
          updateEditForm={updateEditForm}
          closeEditEntry={closeEditEntry}
          handleUpdateEntry={handleUpdateEntry}
          savingEdit={savingEdit}
          editError={editError}
          editSuccess={editSuccess}
          editCalculatedMiles={editCalculatedMiles}
          vehicles={vehicles}
          properties={properties}
          profile={profile}
        />
      )}

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
        <MileageTable
          entries={selectedMonthEntries}
          timesheetMap={timesheetMap}
          properties={properties}
          onDeleteEntry={onDeleteEntry}
          onEditEntry={onEditEntry}
          profile={profile}
        />
      </div>
    </section>
  );
}

function UploadSheetView({
  profile,
  uploads,
  uploadMonthKey,
  setUploadMonthKey,
  uploadNotes,
  setUploadNotes,
  uploadFile,
  onFileChange,
  onFileDrop,
  onUpload,
  uploadingSheet,
  uploadError,
  uploadSuccess,
  draftEntries,
  selectedUploadId,
  setSelectedUploadId,
  properties,
  vehicles,
  entries,
  vehicleOdometerStates,
  convertingUploadId,
  savingDraftUploadId,
  submittingDraftUploadId,
  draftError,
  draftSuccess,
  onOpenUpload,
  onDeleteUpload,
  onConvertUpload,
  onUpdateDraftEntry,
  onAddDraftRow,
  onDeleteDraftRow,
  onSaveDraftRows,
  onSubmitDraftEntries,
}) {
  const draftVehicleOptions = useMemo(() => {
    return Array.from(
      new Set(
        (vehicles || [])
          .map((vehicle) => getWorkerVehicleDisplayName(vehicle, profile))
          .filter(Boolean)
      )
    );
  }, [vehicles, profile]);
  const [expandedUploadIds, setExpandedUploadIds] = useState(new Set());

  function isPaperUploadExpanded(upload) {
    return (
      expandedUploadIds.has(String(upload.id)) ||
      String(selectedUploadId) === String(upload.id)
    );
  }

  function togglePaperUploadDetails(upload) {
    setExpandedUploadIds((currentIds) => {
      const nextIds = new Set(currentIds);
      const uploadId = String(upload.id);

      if (nextIds.has(uploadId)) {
        nextIds.delete(uploadId);
      } else {
        nextIds.add(uploadId);
      }

      return nextIds;
    });
  }

  function handlePaperUploadRowsToggle(upload, isSelected) {
    if (isSelected) {
      setSelectedUploadId("");
      window.setTimeout(() => {
        document
          .getElementById(getPaperUploadElementId("worker-paper-upload", upload.id))
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
      return;
    }

    setExpandedUploadIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(String(upload.id));
      return nextIds;
    });
    setSelectedUploadId(upload.id);

    window.setTimeout(() => {
      document
        .getElementById(getPaperUploadElementId("worker-paper-rows", upload.id))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 xl:p-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <SectionTitle
            eyebrow="Paper Sheet Upload"
            title="Upload Mileage Form"
            text="Upload a photo or PDF of a paper mileage sheet. Admin receives the document immediately and AI scan can turn it into editable draft rows."
          />

          <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <FileUp size={28} />
          </div>
        </div>

        <form onSubmit={onUpload} className="mt-6">
          <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <div
              onDrop={onFileDrop}
              onDragOver={(event) => event.preventDefault()}
              className="flex min-h-[260px] flex-col justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6 text-center transition hover:border-blue-300 hover:bg-blue-50"
            >
              <FileUp className="mx-auto text-blue-600" size={42} />

              <h3 className="mt-4 text-lg font-black text-slate-950">
                Choose Or Drop Paper Sheet File
              </h3>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Drag a JPG, PNG, WEBP, or PDF here, or choose it below. Multi-page PDFs
                can be scanned into one editable review table. Maximum file size is 10 MB.
              </p>

              <input
                id="paper-sheet-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                onChange={onFileChange}
                className="mx-auto mt-6 block w-full max-w-2xl cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-bold file:text-white"
              />

              {uploadFile && (
                <div className="mx-auto mt-4 w-full max-w-2xl rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200">
                  <p className="text-sm font-black text-slate-950">
                    Selected File
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-600">
                    {uploadFile.name}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {formatFileSize(uploadFile.size)} • {uploadFile.type || "file"}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <FormField label="Mileage Month">
                  <input
                    type="month"
                    required
                    value={uploadMonthKey}
                    onChange={(event) => setUploadMonthKey(event.target.value)}
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Worker">
                  <input
                    type="text"
                    value={profile?.full_name || "Worker"}
                    disabled
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 font-bold text-slate-500"
                  />
                </FormField>
              </div>

              <FormField label="Notes For Admin">
                <textarea
                  rows="6"
                  value={uploadNotes}
                  onChange={(event) => setUploadNotes(event.target.value)}
                  placeholder="Example: This is my May mileage sheet. I circled one row that needs review."
                  className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </FormField>

              {uploadError && <AlertBox type="error" message={uploadError} />}
              {uploadSuccess && <AlertBox type="success" message={uploadSuccess} />}

              <button
                type="submit"
                disabled={uploadingSheet || !uploadFile}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-3 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileUp size={19} />
                {uploadingSheet ? "Uploading..." : "Upload Paper Sheet"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 xl:p-8">
        <SectionTitle
          eyebrow="Upload History"
          title="Your Paper Sheets"
          text="Uploaded files are available to admin right away. Use AI scanning to create editable mileage rows, or let admin review the document manually."
        />

        {draftError && <div className="mt-5"><AlertBox type="error" message={draftError} /></div>}
        {draftSuccess && <div className="mt-5"><AlertBox type="success" message={draftSuccess} /></div>}

        <div className="mt-6 space-y-5">
          {uploads.length > 0 ? (
            uploads.map((upload) => {
              const uploadDraftRows = getRenumberedPaperDraftRows(
                draftEntries.filter((row) => {
                  return String(row.upload_id) === String(upload.id);
                })
              );

              const draftTotalMiles = uploadDraftRows.reduce((total, row) => {
                return total + Number(row.miles || 0);
              }, 0);
              const odometerPlan = buildPaperDraftOdometerPlan({
                rows: uploadDraftRows,
                entries,
                vehicles,
                states: vehicleOdometerStates,
                profile,
              });
              const reviewStateByRow = new Map(
                uploadDraftRows.map((row) => {
                  return [
                    String(row.id),
                    getPaperDraftRowReviewState({
                      row,
                      plan: odometerPlan.get(String(row.id)),
                      properties,
                    }),
                  ];
                })
              );
              const rowsNeedingReview = uploadDraftRows.filter((row) => {
                return reviewStateByRow.get(String(row.id))?.blocksSubmit;
              });
              const detectedTotalMiles = toNumberOrNull(upload.total_mileage_detected);
              const hasDetectedTotalMismatch =
                detectedTotalMiles !== null &&
                uploadDraftRows.length > 0 &&
                Math.abs(detectedTotalMiles - draftTotalMiles) > 0.01;

              const isConverting = convertingUploadId === upload.id;
              const isSaving = savingDraftUploadId === upload.id;
              const isSubmitting = submittingDraftUploadId === upload.id;
              const isSubmitted = upload.ai_status === "submitted" || upload.status === "converted";
              const isSelected = String(selectedUploadId) === String(upload.id);
              const isExpanded = isPaperUploadExpanded(upload);
              const uploadElementId = getPaperUploadElementId(
                "worker-paper-upload",
                upload.id
              );
              const rowsElementId = getPaperUploadElementId(
                "worker-paper-rows",
                upload.id
              );

              return (
                <div
                  key={upload.id}
                  id={uploadElementId}
                  className={
                    "prosper-paper-upload-card overflow-hidden rounded-3xl border border-slate-200 bg-white " +
                    (isExpanded ? "is-expanded" : "")
                  }
                >
                  <div className="border-b border-slate-100 bg-slate-50 p-5">
                    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <PaperUploadStatusBadge status={upload.status} />
                          <AiStatusBadge status={upload.ai_status} />
                        </div>

                        <h3 className="mt-3 max-w-xl break-words text-lg font-black text-slate-950">
                          {upload.file_name}
                        </h3>

                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          Uploaded {formatDate(upload.created_at)} • {formatPaperUploadMonth(upload.month_key)} • {formatFileSize(upload.file_size)}
                        </p>

                        <button
                          type="button"
                          onClick={() => togglePaperUploadDetails(upload)}
                          className="mt-3 inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 sm:hidden"
                        >
                          {isExpanded ? "Hide Info" : "Show Info"}
                        </button>

                        {upload.notes && (
                          <p className="prosper-paper-upload-extra mt-3 max-w-3xl rounded-2xl bg-white p-3 text-sm leading-6 text-slate-600 ring-1 ring-slate-200">
                            {upload.notes}
                          </p>
                        )}

                        {upload.ai_error && (
                          <p className="prosper-paper-upload-extra mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold leading-6 text-red-700">
                            {upload.ai_error}
                          </p>
                        )}
                      </div>

                      <div className="prosper-paper-upload-actions flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenUpload(upload)}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                        >
                          <FileUp size={14} />
                          Open
                        </button>

                        <button
                          type="button"
                          disabled={isSubmitted}
                          onClick={() => onAddDraftRow(upload)}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Plus size={14} />
                          Add Row
                        </button>

                        <button
                          type="button"
                          disabled={isConverting || isSubmitted}
                          onClick={() => onConvertUpload(upload)}
                          className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Sparkles size={14} />
                          {isConverting ? "Scanning..." : "Scan With AI"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePaperUploadRowsToggle(upload, isSelected)}
                          className={
                            "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition " +
                            (isSelected
                              ? "bg-slate-900 text-white hover:bg-slate-800"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200")
                          }
                        >
                          <ClipboardList size={14} />
                          {isSelected ? "Close Rows" : "View Rows"}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteUpload(upload)}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="prosper-paper-upload-extra mt-4 grid gap-3 md:grid-cols-3">
                      <ReportMiniCard
                        label="Detected Total"
                        value={formatMiles(upload.total_mileage_detected || 0)}
                      />
                      <ReportMiniCard
                        label="Draft Row Total"
                        value={formatMiles(draftTotalMiles)}
                      />
                      <ReportMiniCard
                        label="Draft Rows"
                        value={uploadDraftRows.length}
                      />
                    </div>
                  </div>

                  {isSelected && (uploadDraftRows.length > 0 ? (
                    <div id={rowsElementId} className="p-5">
                      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                        <div>
                          <h4 className="font-black text-slate-950">
                            Editable AI Draft Rows
                          </h4>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            Review and correct every field before submitting.
                            Property Code must match a property in the system.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isSubmitted}
                            onClick={() => onAddDraftRow(upload)}
                            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Add Row
                          </button>

                          <button
                            type="button"
                            disabled={isSaving || isSubmitted}
                            onClick={() => onSaveDraftRows(upload.id)}
                            className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSaving ? "Saving..." : "Save Draft"}
                          </button>

                          <button
                            type="button"
                            disabled={isSubmitting || isSubmitted}
                            onClick={() => onSubmitDraftEntries(upload)}
                            className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSubmitting ? "Submitting..." : isSubmitted ? "Submitted" : "Submit Entries"}
                          </button>
                        </div>
                      </div>

                      {hasDetectedTotalMismatch && !isSubmitted && (
                        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
                          The scanned sheet total is {formatMiles(detectedTotalMiles)}, but the draft rows add up to {formatMiles(draftTotalMiles)}.
                          Check the Miles column before submitting.
                        </div>
                      )}

                      {rowsNeedingReview.length > 0 && !isSubmitted && (
                        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
                          {rowsNeedingReview.length} row
                          {rowsNeedingReview.length === 1 ? "" : "s"} still need review.
                          Fix vehicle, property code, odometer, miles, or override notes before submitting.
                        </div>
                      )}

                      <div className="overflow-auto rounded-3xl border border-slate-200">
                        <table className="w-full min-w-[1500px] border-collapse text-left text-sm">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <TableHeader>Entry #</TableHeader>
                              <TableHeader>Date</TableHeader>
                              <TableHeader>Vehicle</TableHeader>
                              <TableHeader>Property Code</TableHeader>
                              <TableHeader>Property Address</TableHeader>
                              <TableHeader>Start Odo</TableHeader>
                              <TableHeader>Ending Odo</TableHeader>
                              <TableHeader>Miles</TableHeader>
                              <TableHeader>Purpose</TableHeader>
                              <TableHeader>Review</TableHeader>
                              <TableHeader>Action</TableHeader>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100">
                            {uploadDraftRows.map((row) => (
                              <tr key={row.id} className="bg-white">
                                <td className="px-3 py-3">
                                  <input
                                    type="number"
                                    value={row.entry_number || ""}
                                    disabled={isSubmitted}
                                    onChange={(event) =>
                                      onUpdateDraftEntry(row.id, "entry_number", event.target.value)
                                    }
                                    className="w-20 rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                  />
                                </td>

                                <td className="px-3 py-3">
                                  <input
                                    type="date"
                                    value={toInputDateValue(row.entry_date)}
                                    disabled={isSubmitted}
                                    onChange={(event) =>
                                      onUpdateDraftEntry(row.id, "entry_date", event.target.value)
                                    }
                                    className="w-40 rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                  />
                                </td>

                                <td className="px-3 py-3">
                                  <select
                                    value={row.vehicle || ""}
                                    disabled={isSubmitted}
                                    onChange={(event) =>
                                      onUpdateDraftEntry(row.id, "vehicle", event.target.value)
                                    }
                                    className="w-44 rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                  >
                                    <option value="">Select vehicle</option>
                                    {row.vehicle &&
                                      !draftVehicleOptions.includes(row.vehicle) && (
                                        <option value={row.vehicle}>
                                          {row.vehicle} (scanned)
                                        </option>
                                      )}
                                    {draftVehicleOptions.map((vehicleName) => (
                                      <option key={vehicleName} value={vehicleName}>
                                        {vehicleName}
                                      </option>
                                    ))}
                                  </select>
                                </td>

                                <td className="px-3 py-3">
                                  <PropertyCodeInput
                                    value={row.property_code || ""}
                                    disabled={isSubmitted}
                                    properties={properties}
                                    onChange={(event) =>
                                      onUpdateDraftEntry(row.id, "property_code", event)
                                    }
                                    placeholder="Select code"
                                    className="w-44"
                                  />
                                </td>

                                <td className="px-3 py-3">
                                  <input
                                    type="text"
                                    value={row.property_text || ""}
                                    disabled={isSubmitted}
                                    onChange={(event) =>
                                      onUpdateDraftEntry(row.id, "property_text", event.target.value)
                                    }
                                    placeholder="Property address"
                                    className="w-72 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                  />
                                </td>

                                <td className="px-3 py-3">
                                  <input
                                    type="number"
                                    value={row.start_odometer ?? ""}
                                    disabled={isSubmitted}
                                    onChange={(event) =>
                                      onUpdateDraftEntry(row.id, "start_odometer", event.target.value)
                                    }
                                    className="w-32 rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                  />
                                </td>

                                <td className="px-3 py-3">
                                  <input
                                    type="number"
                                    value={row.end_odometer ?? ""}
                                    disabled={isSubmitted}
                                    onChange={(event) =>
                                      onUpdateDraftEntry(row.id, "end_odometer", event.target.value)
                                    }
                                    className="w-32 rounded-xl border border-slate-200 px-3 py-2 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                  />
                                </td>

                                <td className="px-3 py-3">
                                  <input
                                    type="number"
                                    value={row.miles ?? ""}
                                    disabled={isSubmitted}
                                    onChange={(event) =>
                                      onUpdateDraftEntry(row.id, "miles", event.target.value)
                                    }
                                    className="w-24 rounded-xl border border-slate-200 px-3 py-2 font-black outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                  />
                                </td>

                                <td className="px-3 py-3">
                                  <textarea
                                    rows="2"
                                    value={row.purpose || ""}
                                    disabled={isSubmitted}
                                    onChange={(event) =>
                                      onUpdateDraftEntry(row.id, "purpose", event.target.value)
                                    }
                                    className="w-72 resize-none rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                  />
                                </td>

                                <td className="px-3 py-3">
                                  {(() => {
                                    const plan = odometerPlan.get(String(row.id));
                                    const reviewState =
                                      reviewStateByRow.get(String(row.id)) ||
                                      getPaperDraftRowReviewState({
                                        row,
                                        plan,
                                        properties,
                                      });
                                    const showReviewMessage =
                                      reviewState.message &&
                                      ![
                                        "invalid_vehicle",
                                        "missing_odometer",
                                        "invalid_odometer_range",
                                        "override_required",
                                      ].includes(reviewState.reason);

                                    return (
                                      <>
                                        {plan ? (
                                          <PaperDraftOdometerStatus
                                            plan={plan}
                                            row={row}
                                            disabled={isSubmitted}
                                            onChange={(value) =>
                                              onUpdateDraftEntry(
                                                row.id,
                                                "odometer_override_reason",
                                                value
                                              )
                                            }
                                          />
                                        ) : null}

                                        <span
                                          className={
                                            "rounded-full px-3 py-1 text-xs font-black " +
                                            reviewState.className
                                          }
                                        >
                                          {reviewState.label}
                                        </span>

                                        {showReviewMessage && (
                                          <p className="mt-2 max-w-[220px] text-xs font-semibold leading-5 text-red-600">
                                            {reviewState.message}
                                          </p>
                                        )}
                                      </>
                                    );
                                  })()}

                                  {row.review_notes && (
                                    <p className="mt-2 max-w-[220px] text-xs font-semibold leading-5 text-slate-500">
                                      AI note: {row.review_notes}
                                    </p>
                                  )}
                                  {row.ai_confidence !== null &&
                                    row.ai_confidence !== undefined && (
                                      <p className="mt-1 text-xs font-semibold text-slate-400">
                                        Confidence:{" "}
                                        {Math.round(Number(row.ai_confidence) * 100)}%
                                      </p>
                                    )}
                                </td>

                                <td className="px-3 py-3">
                                  <button
                                    type="button"
                                    disabled={isSubmitted}
                                    onClick={() => onDeleteDraftRow(row)}
                                    className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div id={rowsElementId} className="p-5 text-center">
                      <p className="font-black text-slate-950">
                        No AI draft rows yet.
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Click Scan With AI to extract editable mileage rows
                        from the uploaded paper sheet.
                      </p>
                      {!isSubmitted && (
                        <button
                          type="button"
                          onClick={() => onAddDraftRow(upload)}
                          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-700"
                        >
                          <Plus size={14} />
                          Add Row Manually
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            <div className="rounded-3xl border border-slate-200 px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <FileUp size={28} />
              </div>
              <h3 className="mt-4 text-lg font-black text-slate-950">
                No Uploads Yet
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Uploaded paper mileage sheets will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function getPaperUploadElementId(prefix, uploadId) {
  return `${prefix}-${String(uploadId || "upload").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function ReportMiniCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function getPaperDraftRowReviewState({ row, plan, properties }) {
  const selectedProperty = findPropertyByCode(properties, row.property_code);
  const mileageStatus = getPaperDraftMileageStatus(row);
  const overrideReason = String(row.odometer_override_reason || "").trim();

  if (!row.entry_date) {
    return {
      label: "Review",
      className: "bg-red-50 text-red-700",
      blocksSubmit: true,
      reason: "missing_date",
      message: "Add the entry date.",
    };
  }

  if (!String(row.vehicle || "").trim() || plan?.status === "invalid_vehicle") {
    return {
      label: "Review",
      className: "bg-red-50 text-red-700",
      blocksSubmit: true,
      reason: "invalid_vehicle",
      message: "Choose the exact vehicle from the dropdown.",
    };
  }

  if (!String(row.property_code || "").trim()) {
    return {
      label: "Review",
      className: "bg-red-50 text-red-700",
      blocksSubmit: true,
      reason: "missing_property_code",
      message: "Choose a property code from the property list.",
    };
  }

  if (!selectedProperty) {
    return {
      label: "Review",
      className: "bg-red-50 text-red-700",
      blocksSubmit: true,
      reason: "invalid_property_code",
      message: "Property code must match a property in the system.",
    };
  }

  if (plan?.status === "missing_odometer" || mileageStatus.reason === "missing_odometer") {
    return {
      label: "Review",
      className: "bg-red-50 text-red-700",
      blocksSubmit: true,
      reason: "missing_odometer",
      message: "Add start and ending odometer.",
    };
  }

  if (
    plan?.status === "invalid_odometer_range" ||
    mileageStatus.reason === "invalid_odometer_range"
  ) {
    return {
      label: "Review",
      className: "bg-red-50 text-red-700",
      blocksSubmit: true,
      reason: "invalid_odometer_range",
      message: "Ending odometer must be greater than or equal to start odometer.",
    };
  }

  if (mileageStatus.blocksSubmit) {
    return {
      label: "Review",
      className: "bg-red-50 text-red-700",
      blocksSubmit: true,
      reason: mileageStatus.reason,
      message: mileageStatus.message,
    };
  }

  if (plan?.requiresOverride && !overrideReason) {
    return {
      label: "Review",
      className: "bg-red-50 text-red-700",
      blocksSubmit: true,
      reason: "override_required",
      message: "Enter an override reason for the odometer difference.",
    };
  }

  if (plan?.requiresOverride) {
    return {
      label: "Override",
      className: "bg-amber-50 text-amber-700",
      blocksSubmit: false,
      reason: "override_ready",
      message: "Override reason is ready for submit.",
    };
  }

  return {
    label: "OK",
    className: "bg-emerald-50 text-emerald-700",
    blocksSubmit: false,
    reason: "ready",
    message: "",
  };
}

function getPaperDraftMileageStatus(row) {
  const start = toNumberOrNull(row.start_odometer);
  const end = toNumberOrNull(row.end_odometer);
  const miles = toNumberOrNull(row.miles);

  if (start === null || end === null) {
    return {
      blocksSubmit: true,
      reason: "missing_odometer",
      message: "Add start and ending odometer.",
    };
  }

  if (end < start) {
    return {
      blocksSubmit: true,
      reason: "invalid_odometer_range",
      message: "Ending odometer must be greater than or equal to start odometer.",
    };
  }

  const expectedMiles = end - start;

  if (miles === null) {
    return {
      blocksSubmit: true,
      reason: "missing_miles",
      message: `Miles must be ${formatMiles(expectedMiles)} from the odometer.`,
    };
  }

  if (Math.abs(miles - expectedMiles) > 0.01) {
    return {
      blocksSubmit: true,
      reason: "miles_mismatch",
      message: `Miles should be ${formatMiles(expectedMiles)} because ${end} - ${start} = ${formatMiles(expectedMiles)}.`,
    };
  }

  return {
    blocksSubmit: false,
    reason: "ready",
    message: "",
    expectedMiles,
  };
}

function PaperDraftOdometerStatus({ plan, row, disabled, onChange }) {
  if (!plan) return null;

  if (plan.status === "invalid_vehicle") {
    return (
      <div className="mb-3 max-w-[260px] rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">
        Choose the exact vehicle from the dropdown before submitting.
      </div>
    );
  }

  if (plan.status === "missing_odometer") {
    return (
      <div className="mb-3 max-w-[260px] rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-700">
        Add start and ending odometer to check continuity.
      </div>
    );
  }

  if (plan.status === "invalid_odometer_range") {
    return (
      <div className="mb-3 max-w-[260px] rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">
        Ending odometer must be greater than or equal to start odometer.
      </div>
    );
  }

  if (plan.requiresOverride) {
    return (
      <div className="mb-3 max-w-[280px] rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">
        <p>
          Start is lower than the previous odometer for {plan.vehicleName}.
        </p>
        <p className="mt-1">
          Expected {plan.expectedStartOdometer}; entered {row.start_odometer}.
        </p>
        <input
          type="text"
          value={row.odometer_override_reason || ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Override reason required"
          className="mt-2 h-9 w-full rounded-xl border border-red-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition placeholder:text-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100"
        />
      </div>
    );
  }

  if (plan.startsHigherThanExpected) {
    return (
      <div className="mb-3 max-w-[280px] rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold leading-5 text-blue-700">
        Starts higher than previous odometer. OK to submit;{" "}
        {formatMiles(plan.unattributedMiles)} will be recorded as unattributed miles.
      </div>
    );
  }

  if (plan.isContinuous) {
    return (
      <div className="mb-3 max-w-[260px] rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold leading-5 text-emerald-700">
        Continuous with previous odometer: {plan.expectedStartOdometer}.
      </div>
    );
  }

  return (
    <div className="mb-3 max-w-[260px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold leading-5 text-slate-600">
      Previous odometer: {plan.expectedStartOdometer}.
    </div>
  );
}

function AiStatusBadge({ status }) {
  const cleanStatus = String(status || "not_started").toLowerCase();

  const statusClasses = {
    not_started: "bg-slate-100 text-slate-600",
    processing: "bg-amber-50 text-amber-700",
    converted: "bg-blue-50 text-blue-700",
    needs_review: "bg-violet-50 text-violet-700",
    submitted: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={
        "inline-flex rounded-full px-3 py-1 text-xs font-black capitalize " +
        (statusClasses[cleanStatus] || statusClasses.not_started)
      }
    >
      AI: {cleanStatus.replaceAll("_", " ")}
    </span>
  );
}
// Legacy helper kept for reference while the AIWorkerHelpBot is the active help UI.
// eslint-disable-next-line no-unused-vars
function WorkerHelpBot({ setActiveView }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text:
        "Hi! I can help you find where to add mileage, upload paper sheets, review history, message admin, or use route tools.",
      actions: [
        { label: "Add Mileage", view: "new-entry" },
        { label: "Upload Sheet", view: "upload" },
        { label: "Message Admin", view: "messages" },
        { label: "Open Manual", url: WORKER_MANUAL_URL },
      ],
    },
  ]);

  const quickPrompts = [
    "Where do I submit mileage?",
    "How do I upload a paper sheet?",
    "Where can I review my records?",
    "How do I message admin?",
  ];

  function getBotReply(userText) {
    const text = String(userText || "").toLowerCase();

    if (
      text.includes("manual") ||
      text.includes("guide") ||
      text.includes("instructions") ||
      text.includes("step by step")
    ) {
      return {
        text:
          "Open the Mileage Tracker User Manual for step-by-step help with mileage entries, paper sheet uploads, history, messages, route tools, and support.",
        actions: [{ label: "Open Manual", url: WORKER_MANUAL_URL }],
      };
    }

    if (
      text.includes("submit") ||
      text.includes("entry") ||
      text.includes("entries") ||
      text.includes("mileage") ||
      text.includes("add")
    ) {
      return {
        text:
          "To submit mileage, go to New Mileage Entry. Add the date, vehicle, property, start odometer, end odometer, and purpose, then save it.",
        actions: [{ label: "Go To New Mileage Entry", view: "new-entry" }],
      };
    }

    if (
      text.includes("upload") ||
      text.includes("paper") ||
      text.includes("sheet") ||
      text.includes("file") ||
      text.includes("document") ||
      text.includes("photo") ||
      text.includes("pdf")
    ) {
      return {
        text:
          "To upload a paper mileage sheet, go to Upload Paper Sheet. Choose your file, select the month, add notes if needed, and upload it. AI scan can turn it into editable rows, and admin can still review it manually.",
        actions: [{ label: "Go To Upload Paper Sheet", view: "upload" }],
      };
    }

    if (
      text.includes("history") ||
      text.includes("records") ||
      text.includes("past") ||
      text.includes("download") ||
      text.includes("csv")
    ) {
      return {
        text:
          "To review saved mileage records, go to Mileage History. You can check entries for the selected month, edit corrections, delete mistakes, or download your CSV.",
        actions: [{ label: "Go To Mileage History", view: "history" }],
      };
    }

    if (
      text.includes("admin") ||
      text.includes("message") ||
      text.includes("chat") ||
      text.includes("help") ||
      text.includes("question") ||
      text.includes("correction")
    ) {
      return {
        text:
          "To contact admin, go to Messages. You can ask about corrections, missing mileage, paper sheet uploads, or property questions.",
        actions: [{ label: "Go To Messages", view: "messages" }],
      };
    }

    if (
      text.includes("route") ||
      text.includes("map") ||
      text.includes("address") ||
      text.includes("location") ||
      text.includes("directions")
    ) {
      return {
        text:
          "For route help, use the Central Wisconsin Map Search card on the Overview page. You can search a property address or city and open it in Google Maps.",
        actions: [{ label: "Go To Overview", view: "overview" }],
      };
    }

    if (
      text.includes("password") ||
      text.includes("login") ||
      text.includes("sign in") ||
      text.includes("account")
    ) {
      return {
        text:
          "For login or password issues, use Forgot Password on the login page. If your profile looks incorrect, message admin for help.",
        actions: [{ label: "Message Admin", view: "messages" }],
      };
    }

    return {
      text:
        "I can help with mileage entries, paper uploads, mileage history, messages, route tools, and general app directions. Try asking: Where do I upload my paper sheet?",
      actions: [
        { label: "Add Mileage", view: "new-entry" },
        { label: "Upload Sheet", view: "upload" },
        { label: "View History", view: "history" },
        { label: "Open Manual", url: WORKER_MANUAL_URL },
      ],
    };
  }

  function sendMessage(textOverride) {
    const cleanText = String(textOverride || draft).trim();

    if (!cleanText) return;

    const reply = getBotReply(cleanText);

    setMessages((currentMessages) => [
      ...currentMessages,
      { sender: "user", text: cleanText },
      { sender: "bot", text: reply.text, actions: reply.actions || [] },
    ]);

    setDraft("");
    setIsOpen(true);
  }

  function goToView(view) {
    setActiveView(view);
    setIsOpen(false);
  }

  function handleBotAction(action) {
    if (action?.url) {
      window.open(action.url, "_blank", "noopener,noreferrer");
      return;
    }

    goToView(action.view);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen && (
        <div className="mb-4 flex h-[520px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-400/30 ring-1 ring-slate-200">
          <div className="prosper-hero-gradient flex items-center justify-between gap-4 p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/15 p-3">
                <Bot size={22} />
              </div>

              <div>
                <p className="text-sm font-black">Mileage Help Assistant</p>
                <p className="text-xs font-semibold text-blue-100">
                  
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20"
              aria-label="Close help assistant"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message, index) => {
              const isUser = message.sender === "user";

              return (
                <div
                  key={index}
                  className={isUser ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      "max-w-[88%] rounded-3xl px-4 py-3 text-sm font-semibold leading-6 " +
                      (isUser
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-700 shadow-sm ring-1 ring-slate-200")
                    }
                  >
                    <p>{message.text}</p>

                    {!isUser && message.actions?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                          <button
                            key={action.label}
                            type="button"
                            onClick={() => handleBotAction(action)}
                            className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask how to use the app..."
                className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />

              <button
                type="submit"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
                aria-label="Send help question"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-3 rounded-full bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-2xl shadow-blue-300 transition hover:-translate-y-0.5 hover:bg-blue-700"
      >
        <Bot size={22} />
        {isOpen ? "Close Help" : "Need Help?"}
      </button>
    </div>
  );
}


function MessagesView({
  profile,
  messages,
  messageDraft,
  setMessageDraft,
  sendingMessage,
  messageError,
  onSendMessage,
}) {
  const sortedMessages = useMemo(() => {
    return [...(messages || [])].sort((first, second) => {
      return new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
    });
  }, [messages]);

  return (
    <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600">
          <MessageCircle size={28} />
        </div>

        <SectionTitle
          eyebrow="Messages"
          title="Chat With Admin"
          text="Send mileage questions, correction requests, and help messages directly to admin. Messages update live when Supabase Realtime is enabled for the messages table."
        />

        <div className="mt-6 space-y-3">
          <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
            <p className="font-black text-blue-900">Admin Support</p>
            <p className="mt-2 text-sm leading-6 text-blue-800">
              Use this chat for missing mileage details, property questions,
              correction requests, or paper sheet upload help.
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-[640px] flex-col rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <MessageCircle size={22} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">
                Admin Support
              </p>
              <p className="truncate text-xs font-semibold text-slate-500">
                Signed in as {profile?.full_name || "Worker"}
              </p>
            </div>
          </div>

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            Live Chat
          </span>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-5">
          {sortedMessages.length > 0 ? (
            sortedMessages.map((message) => {
              const isWorkerMessage = message.sender_role === "driver";

              return (
                <ChatBubble
                  key={message.id}
                  side={isWorkerMessage ? "right" : "left"}
                  name={isWorkerMessage ? profile?.full_name || "You" : "Admin"}
                  text={message.body}
                  createdAt={message.created_at}
                />
              );
            })
          ) : (
            <div className="flex h-full items-center justify-center text-center">
              <div className="mx-auto max-w-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <MessageCircle size={28} />
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-950">
                  No Messages Yet
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Send your first message to admin if you need help with mileage,
                  property selection, uploads, or corrections.
                </p>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={onSendMessage} className="border-t border-slate-200 p-5">
          {messageError && <AlertBox type="error" message={messageError} />}

          <div className="mt-3 flex gap-3">
            <input
              type="text"
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
              disabled={sendingMessage}
              placeholder="Type your message to admin..."
              className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            <button
              type="submit"
              disabled={sendingMessage || !messageDraft.trim()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function HelpView() {
  return (
    <section className="space-y-6">
      <div className="prosper-glass-card rounded-[2rem] p-6 shadow-sm ring-1 ring-slate-200">
        <SectionTitle
          eyebrow="Help"
          title="Mileage Tracker Guide"
          text="Use this portal to add mileage, review saved trips, upload paper forms, check routes, and message admin for support."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <SmallInfoCard
            title="Mileage Entries"
            text="Use New Mileage Entry to submit daily trips with date, vehicle, property, odometer readings, miles, and purpose."
          />

          <SmallInfoCard
            title="Paper Sheets"
            text="Upload photos or PDFs of paper mileage forms. Scan With AI creates editable draft rows before final submission."
          />

          <SmallInfoCard
            title="Admin Chat"
            text="Use Messages to ask admin about corrections, missing details, property questions, or paper sheet review."
          />
        </div>

        <ManualHelpPanel />
      </div>

      <RouteToolsCard />
    </section>
  );
}

function ManualHelpPanel() {
  return (
    <div className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm ring-1 ring-blue-50 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <BookOpen size={26} />
          </div>

          <div>
            <h3 className="text-xl font-black text-slate-950">
              Mileage Tracker User Manual
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              This guide explains how to use the worker portal step by step.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={WORKER_MANUAL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
          >
            <ExternalLink size={17} />
            Open User Manual
          </a>

          <a
            href={WORKER_MANUAL_URL}
            download="mileage-tracker-worker-user-manual.pdf"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Download size={17} />
            Download Manual
          </a>
        </div>
      </div>
    </div>
  );
}



function MileageTable({
  entries,
  timesheetMap = new Map(),
  properties = [],
  compact = false,
  onDeleteEntry,
  onEditEntry,
  profile,
}) {
  const tableMinWidth = compact ? "min-w-[1100px]" : "min-w-[1250px]";
  const scrollHeight = compact ? "max-h-[430px]" : "max-h-[680px]";

  if (!entries || entries.length === 0) {
    return (
      <div className={`${scrollHeight} overflow-auto`}>
        <table className={`w-full ${tableMinWidth} border-collapse text-left text-sm`}>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <TableHeader>Date</TableHeader>
              <TableHeader>Vehicle</TableHeader>
              <TableHeader>Property</TableHeader>
              <TableHeader>Purpose</TableHeader>
              <TableHeader>Miles</TableHeader>
              <TableHeader>Status</TableHeader>
              {!compact && <TableHeader>Action</TableHeader>}
            </tr>
          </thead>

          <tbody>
            <tr>
              <td colSpan={compact ? "6" : "7"} className="px-6 py-12">
                <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <MapPin size={28} />
                  </div>

                  <h3 className="mt-4 text-lg font-black text-slate-950">
                    No Entries Found
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    No mileage entries were found for this selected month.
                  </p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={`${scrollHeight} overflow-auto`}>
      <table className={`w-full ${tableMinWidth} border-collapse text-left text-sm`}>
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <TableHeader>Date</TableHeader>
            <TableHeader>Vehicle</TableHeader>
            <TableHeader>Property</TableHeader>
            <TableHeader>Purpose</TableHeader>
            <TableHeader>Miles</TableHeader>
            <TableHeader>Status</TableHeader>
            {!compact && <TableHeader>Action</TableHeader>}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <tr key={entry.id} className="bg-white">
              <td className="px-4 py-4 font-semibold text-slate-700">
                {formatDate(getEntryDate(entry))}
              </td>

              <td className="px-4 py-4 text-slate-600">
                {formatVehicleNameForDisplay(entry.vehicle || "—", profile)}
              </td>

              <td className="px-4 py-4 text-slate-600">
                {hasJobberMileage(entry) || entry.jobber_timesheet_id ? (
                  <JobberMileageCell
                    entry={entry}
                    timesheet={timesheetMap.get(String(entry.jobber_timesheet_id))}
                    properties={properties}
                  />
                ) : (
                  entry.property_display || entry.property_code || "—"
                )}
              </td>

              <td className="max-w-[340px] px-4 py-4 text-slate-600">
                <p className="line-clamp-3 leading-6">
                  {entry.purpose || "—"}
                </p>
                <p className="mt-1 text-[11px] font-black uppercase text-slate-400">
                  {getMileageBucketLabelForEntry(
                    entry,
                    timesheetMap.get(String(entry.jobber_timesheet_id))
                  )}
                </p>
              </td>

              <td className="px-4 py-4 font-black text-slate-950">
                {formatMiles(getEntryMiles(entry))}
              </td>

              <td className="px-4 py-4">
                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black capitalize text-emerald-700">
                  {getEntryStatus(entry)}
                </span>
              </td>

              {!compact && (
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onEditEntry?.(entry)}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteEntry?.(entry.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobberMileageCell({ entry, timesheet, properties = [] }) {
  const isTimesheetEntry = Boolean(entry.jobber_timesheet_id);
  const sourceLabel = isTimesheetEntry ? "Jobber Timesheet" : "Jobber Visit";
  const jobberJobUrl = getJobberJobUrl(entry, timesheet);
  const resolvedPropertyCode = getResolvedEntryPropertyCode(entry, timesheet, properties);

  return (
    <div className="max-w-[360px]">
      <div className="mb-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700">
        {sourceLabel}
      </div>
      <p className="font-black text-slate-950">
        {entry.jobber_job_title || timesheet?.jobber_job_title || sourceLabel}
      </p>
      {(entry.jobber_job_number || timesheet?.jobber_job_number) && (
        <p className="mt-1 text-xs font-bold text-slate-500">
          Job #{entry.jobber_job_number || timesheet?.jobber_job_number}
        </p>
      )}
      {resolvedPropertyCode && (
        <p className="mt-1 text-xs font-black text-slate-600">
          Property Code: {resolvedPropertyCode}
        </p>
      )}
      <p className="mt-2 text-sm font-semibold text-slate-700">
        {entry.jobber_client_name || timesheet?.jobber_client_name || "No client name"}
      </p>
      <p className="mt-1 text-sm leading-5 text-slate-500">
        {entry.jobber_property_address ||
          timesheet?.jobber_property_address ||
          entry.property_display ||
          "No address"}
      </p>
      {timesheet && (
        <p className="mt-2 text-xs font-semibold text-slate-500">
          {formatTimesheetTime(timesheet.start_at)} - {formatTimesheetTime(timesheet.end_at)} - {formatTimesheetDuration(timesheet.duration_minutes)}
        </p>
      )}
      {jobberJobUrl && (
        <a
          href={jobberJobUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-black text-blue-700 hover:text-blue-900"
        >
          Open Jobber Job
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  );
}

function SectionTitle({ eyebrow, title, text, titleClassName = "text-2xl" }) {
  return (
    <div>
      {eyebrow && (
        <p className="text-sm font-black uppercase tracking-wide text-blue-600">
          {eyebrow}
        </p>
      )}

      <h2 className={`mt-1 font-black text-slate-950 ${titleClassName}`}>
        {title}
      </h2>

      {text && (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          {text}
        </p>
      )}
    </div>
  );
}

function HeroMiniStat({ label, value, icon }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <div className="mb-3 inline-flex rounded-2xl bg-white/10 p-2 text-blue-100">
        {icon}
      </div>

      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black capitalize text-white">{value}</p>
    </div>
  );
}

function KpiCard({ icon, label, value, helper, accent }) {
  const accentClasses = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{helper}</p>
        </div>

        <div
          className={`rounded-2xl p-3 ${
            accentClasses[accent] || accentClasses.blue
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ icon, title, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-3xl bg-slate-50 p-5 text-left ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"
    >
      <div className="mb-4 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600">
        {icon}
      </div>

      <h3 className="font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </button>
  );
}

function FormField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function TableHeader({ children }) {
  return (
    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-4 font-black shadow-sm">
      {children}
    </th>
  );
}

function AlertBox({ type, message }) {
  const className =
    type === "success"
      ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
      : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700";

  return <div className={className}>{message}</div>;
}

function EmptyState({ title, text }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Route size={28} />
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function SmallInfoCard({ title, text }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
      <h3 className="font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function ChatBubble({ side, name, text, createdAt }) {
  const isRight = side === "right";

  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-3xl px-4 py-3 shadow-sm ${
          isRight ? "bg-blue-600 text-white" : "bg-white text-slate-800 ring-1 ring-slate-200"
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <p
            className={`text-xs font-black ${
              isRight ? "text-blue-100" : "text-slate-500"
            }`}
          >
            {name}
          </p>
          <p
            className={`text-[11px] font-bold ${
              isRight ? "text-blue-100" : "text-slate-400"
            }`}
          >
            {formatMessageTime(createdAt)}
          </p>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{text}</p>
      </div>
    </div>
  );
}


async function getWorkerPaperSheetDraftEntries(workerId) {
  if (!workerId) return [];

  const { data, error } = await supabase
    .from("paper_sheet_draft_entries")
    .select("*")
    .eq("worker_id", workerId)
    .order("entry_number", { ascending: true });

  if (error) throw error;

  return data || [];
}

function getSortedPaperDraftRows(rows = []) {
  return [...(rows || [])].sort((first, second) => {
    const firstEntry = Number(first.entry_number || 0);
    const secondEntry = Number(second.entry_number || 0);

    if (firstEntry !== secondEntry) {
      return firstEntry - secondEntry;
    }

    const dateCompare = String(first.entry_date || "").localeCompare(
      String(second.entry_date || "")
    );

    if (dateCompare !== 0) {
      return dateCompare;
    }

    const createdCompare = String(first.created_at || "").localeCompare(
      String(second.created_at || "")
    );

    if (createdCompare !== 0) {
      return createdCompare;
    }

    return String(first.id || "").localeCompare(String(second.id || ""));
  });
}

function getRenumberedPaperDraftRows(rows = []) {
  return getSortedPaperDraftRows(rows).map((row, index) => ({
    ...row,
    entry_number: index + 1,
  }));
}

function renumberPaperDraftRowsForUpload(rows = [], uploadId) {
  const renumberedRows = getRenumberedPaperDraftRows(
    rows.filter((row) => String(row.upload_id) === String(uploadId))
  );
  const renumberedById = new Map(
    renumberedRows.map((row) => [String(row.id), row])
  );

  return rows.map((row) => renumberedById.get(String(row.id)) || row);
}

async function renumberPaperDraftRowsInDatabase(uploadId, workerId) {
  if (!uploadId || !workerId) return;

  const { data, error } = await supabase
    .from("paper_sheet_draft_entries")
    .select("id, upload_id, entry_number, entry_date, created_at")
    .eq("upload_id", uploadId)
    .eq("worker_id", workerId)
    .order("entry_number", { ascending: true });

  if (error) throw error;

  const renumberedRows = getRenumberedPaperDraftRows(data || []);

  await Promise.all(
    renumberedRows.map((row) => {
      return supabase
        .from("paper_sheet_draft_entries")
        .update({ entry_number: row.entry_number })
        .eq("id", row.id);
    })
  ).then((results) => {
    const failedResult = results.find((result) => result.error);

    if (failedResult?.error) {
      throw failedResult.error;
    }
  });
}

function buildDraftEntryPayload(row) {
  return {
    entry_number: row.entry_number === "" ? null : Number(row.entry_number),
    entry_date: row.entry_date || null,
    vehicle: row.vehicle || "",
    property_text: row.property_text || "",
    property_code: row.property_code || "",
    start_odometer:
      row.start_odometer === "" || row.start_odometer === null
        ? null
        : Number(row.start_odometer),
    end_odometer:
      row.end_odometer === "" || row.end_odometer === null
        ? null
        : Number(row.end_odometer),
    miles:
      row.miles === "" || row.miles === null
        ? null
        : Number(row.miles),
    purpose: row.purpose || "",
    review_notes: row.review_notes || null,
    ai_confidence:
      row.ai_confidence === "" || row.ai_confidence === null
        ? null
        : Number(row.ai_confidence),
    needs_review: Boolean(row.needs_review || row.review_notes),
  };
}


async function getWorkerPaperSheetUploads(workerId) {
  if (!workerId) return [];

  const { data, error } = await supabase
    .from("paper_sheet_uploads")
    .select("*")
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

function isAllowedPaperSheetFile(file) {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  return allowedTypes.includes(file?.type);
}

function formatPaperSheetUploadError(error, fallbackMessage) {
  const message = String(error?.message || "");
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("row-level security") || lowerMessage.includes("rls")) {
    return (
      "Supabase blocked this paper-sheet upload with Row Level Security. Run the paper-sheet upload RLS policy SQL for paper_sheet_uploads, paper_sheet_draft_entries, and the paper-sheets storage bucket, then try again. Original error: " +
      (message || "RLS blocked the request.")
    );
  }

  return message || fallbackMessage;
}

function sanitizeFileName(fileName) {
  return String(fileName || "paper-sheet")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function PaperUploadStatusBadge({ status }) {
  const cleanStatus = String(status || "uploaded").toLowerCase();

  const statusClasses = {
    uploaded: "bg-blue-50 text-blue-700",
    received: "bg-emerald-50 text-emerald-700",
    reviewing: "bg-amber-50 text-amber-700",
    converted: "bg-violet-50 text-violet-700",
    rejected: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={
        "inline-flex rounded-full px-3 py-1 text-xs font-black capitalize " +
        (statusClasses[cleanStatus] || statusClasses.uploaded)
      }
    >
      {cleanStatus.replaceAll("_", " ")}
    </span>
  );
}

function formatPaperUploadMonth(monthKey) {
  if (!monthKey) return "—";
  return formatMonthKey(monthKey);
}

function formatFileSize(size) {
  const numberSize = Number(size);

  if (!numberSize || Number.isNaN(numberSize)) {
    return "Unknown size";
  }

  if (numberSize < 1024) {
    return numberSize + " B";
  }

  if (numberSize < 1024 * 1024) {
    return (numberSize / 1024).toFixed(1) + " KB";
  }

  return (numberSize / (1024 * 1024)).toFixed(1) + " MB";
}


async function getWorkerMessages(workerId) {
  if (!workerId) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("worker_id", workerId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data || [];
}

function formatMessageTime(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPageTitle(activeView) {
  const item = navigationItems.find((navItem) => navItem.id === activeView);
  return item?.label || "Worker Dashboard";
}

function getVehicleLabel(vehicle) {
  if (!vehicle) {
    return "";
  }

  return vehicle.display_name || vehicle.vehicle_name || "";
}

function getWorkerVehicleDisplayName(vehicle, profile) {
  const vehicleName = getVehicleLabel(vehicle);
  return formatVehicleNameForDisplay(vehicleName, profile);
}

function getWorkerDefaultVehicleName(profile) {
  return String(
    profile?.default_vehicle_name ||
      profile?.default_vehicle ||
      profile?.preferred_vehicle ||
      ""
  ).trim();
}

function getPreferredWorkerVehicle(vehicles, profile) {
  const savedVehicleName = getWorkerDefaultVehicleName(profile);
  const savedVehicleId = String(profile?.default_vehicle_id || "").trim();

  return (
    findWorkerVehicleByDisplayName(vehicles, savedVehicleName, profile) ||
    (savedVehicleId
      ? (vehicles || []).find((vehicle) => {
          return (
            String(vehicle.id || "") === savedVehicleId ||
            String(vehicle.base_vehicle_id || "") === savedVehicleId ||
            String(vehicle.vehicle_id || "") === savedVehicleId
          );
        })
      : null) ||
    (vehicles || [])[0] ||
    null
  );
}

function getWorkerFormVehicleName(form, vehicles, profile) {
  if (form?.vehicleId === OTHER_COMPANY_VEHICLE_ID) {
    return String(form.customVehicleName || "").trim();
  }

  const selectedVehicle = (vehicles || []).find((vehicle) => {
    return String(vehicle.id) === String(form?.vehicleId);
  });

  return getWorkerVehicleDisplayName(selectedVehicle, profile);
}

function syncPurposeWithVehicleUnitPrefix(purpose, vehicleOrName) {
  const cleanPurpose = removeVehicleUnitPurposePrefix(purpose);
  const unitLabel = getVehicleUnitLabel(vehicleOrName);

  if (!unitLabel) {
    return cleanPurpose;
  }

  return cleanPurpose ? `${unitLabel} - ${cleanPurpose}` : `${unitLabel} - `;
}

function removeVehicleUnitPurposePrefix(purpose) {
  return String(purpose || "")
    .replace(/^\s*(?:van\s*#?\s*\d+|tall\s*boy\s*#?\s*\d+)\s*-\s*/i, "")
    .trimStart();
}

function getVehicleUnitLabel(vehicleOrName) {
  const explicitUnit =
    typeof vehicleOrName === "object" && vehicleOrName !== null
      ? vehicleOrName.vehicle_unit ||
        vehicleOrName.vehicle_subclass ||
        vehicleOrName.subclass
      : "";
  const explicitLabel = normalizeVehicleUnitLabel(explicitUnit);

  if (explicitLabel) {
    return explicitLabel;
  }

  const vehicleName =
    typeof vehicleOrName === "object" && vehicleOrName !== null
      ? getVehicleLabel(vehicleOrName)
      : String(vehicleOrName || "");

  const nameParts = String(vehicleName || "")
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .reverse();

  for (const part of nameParts) {
    const label = normalizeVehicleUnitLabel(part);

    if (label) {
      return label;
    }
  }

  return "";
}

function normalizeVehicleUnitLabel(value) {
  const text = String(value || "").trim();
  const vanMatch = text.match(/\bvan\s*#?\s*(\d+)\b/i);

  if (vanMatch) {
    return `Van #${vanMatch[1]}`;
  }

  const tallBoyMatch = text.match(/\btall\s*boy\s*#?\s*(\d+)\b/i);

  if (tallBoyMatch) {
    return `Tall Boy #${tallBoyMatch[1]}`;
  }

  return "";
}

function findWorkerVehicleByDisplayName(vehicles, vehicleName, profile) {
  const normalizedVehicleName = normalizeVehicleLabel(vehicleName);

  if (!normalizedVehicleName) {
    return null;
  }

  return (
    (vehicles || []).find((vehicle) => {
      return (
        normalizeVehicleLabel(getWorkerVehicleDisplayName(vehicle, profile)) ===
        normalizedVehicleName
      );
    }) || null
  );
}

function buildPaperDraftOdometerPlan({
  rows = [],
  entries = [],
  vehicles = [],
  states = [],
  profile = null,
}) {
  const planMap = new Map();
  const expectedByVehicle = new Map();

  const sortedRows = [...(rows || [])].sort((first, second) => {
    const firstEntry = Number(first.entry_number || 0);
    const secondEntry = Number(second.entry_number || 0);

    if (firstEntry !== secondEntry) return firstEntry - secondEntry;

    return String(first.entry_date || "").localeCompare(String(second.entry_date || ""));
  });

  sortedRows.forEach((row) => {
    const selectedVehicle = findWorkerVehicleByDisplayName(
      vehicles,
      row.vehicle,
      profile
    );

    if (!selectedVehicle) {
      planMap.set(String(row.id), {
        status: "invalid_vehicle",
        vehicleName: row.vehicle || "",
      });
      return;
    }

    const vehicleName = getWorkerVehicleDisplayName(selectedVehicle, profile);
    const vehicleKey = normalizeVehicleLabel(vehicleName);
    const latestEndOdometer = getLatestEndOdometerForVehicle(entries, vehicleName);
    const baseline = getExpectedVehicleStart({
      states,
      vehicle: selectedVehicle,
      vehicleName,
      fallbackOdometer: latestEndOdometer,
    });
    const expectedStartOdometer = expectedByVehicle.has(vehicleKey)
      ? expectedByVehicle.get(vehicleKey)
      : String(baseline.expectedStartOdometer || "0");
    const expectedStart = toNumberOrNull(expectedStartOdometer);
    const start = toNumberOrNull(row.start_odometer);
    const end = toNumberOrNull(row.end_odometer);

    if (start === null || end === null) {
      planMap.set(String(row.id), {
        status: "missing_odometer",
        vehicleName,
        expectedStartOdometer,
      });
      return;
    }

    if (end < start) {
      planMap.set(String(row.id), {
        status: "invalid_odometer_range",
        vehicleName,
        expectedStartOdometer,
        startOdometer: start,
        endOdometer: end,
      });
      return;
    }

    const requiresOverride =
      expectedStart !== null && start < expectedStart;
    const startsHigherThanExpected =
      expectedStart !== null && start > expectedStart;
    const isContinuous = expectedStart !== null && start === expectedStart;

    planMap.set(String(row.id), {
      status: requiresOverride
        ? "requires_override"
        : startsHigherThanExpected
          ? "starts_higher"
          : isContinuous
            ? "continuous"
            : "ready",
      vehicleName,
      expectedStartOdometer,
      startOdometer: start,
      endOdometer: end,
      requiresOverride,
      startsHigherThanExpected,
      isContinuous,
      unattributedMiles: startsHigherThanExpected ? start - expectedStart : 0,
    });

    if (end >= start) {
      expectedByVehicle.set(vehicleKey, String(end));
    }
  });

  return planMap;
}

function formatVehicleNameForDisplay(vehicleName, profile) {
  const cleanVehicleName = String(vehicleName || "").trim();
  const workerName = String(profile?.full_name || "Worker").trim();

  if (!cleanVehicleName) {
    return "";
  }

  const lowerVehicleName = cleanVehicleName.toLowerCase();

  if (lowerVehicleName === "personal") {
    return `Personal - ${workerName}`;
  }

  if (lowerVehicleName.startsWith("personal -")) {
    return cleanVehicleName;
  }

  if (lowerVehicleName.endsWith("- personal")) {
    const ownerName = cleanVehicleName
      .replace(/\s*-\s*personal$/i, "")
      .trim();

    return `Personal - ${ownerName || workerName}`;
  }

  return cleanVehicleName;
}

function normalizeVehicleLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ");
}

function isPersonalVehicleLabel(value) {
  const normalizedValue = normalizeVehicleLabel(value);

  return (
    normalizedValue === "personal" ||
    normalizedValue.startsWith("personal -") ||
    normalizedValue.endsWith("- personal")
  );
}

function vehicleLabelsMatch(firstLabel, secondLabel) {
  const normalizedFirst = normalizeVehicleLabel(firstLabel);
  const normalizedSecond = normalizeVehicleLabel(secondLabel);

  if (!normalizedFirst || !normalizedSecond) {
    return false;
  }

  if (normalizedFirst === normalizedSecond) {
    return true;
  }

  return (
    isPersonalVehicleLabel(normalizedFirst) &&
    isPersonalVehicleLabel(normalizedSecond)
  );
}

function getLatestEndOdometerForVehicle(entries, vehicleName) {
  if (!vehicleName) {
    return "";
  }

  const latestMatchingEntry = (entries || []).find((entry) => {
    return (
      vehicleLabelsMatch(getEntryVehicle(entry), vehicleName) &&
      getEntryEndOdometer(entry) !== null &&
      getEntryEndOdometer(entry) !== undefined &&
      getEntryEndOdometer(entry) !== ""
    );
  });

  return latestMatchingEntry ? getEntryEndOdometer(latestMatchingEntry) : "";
}

function getPropertyDisplayLabel(property) {
  if (!property) {
    return "";
  }

  if (property.display_label) {
    return formatPropertyTextForDisplay(property.display_label);
  }

  if (property.display_name) {
    return formatPropertyTextForDisplay(property.display_name);
  }

  const propertyCode = formatPropertyCodeForDisplay(property.property_code);
  const address = [
    property.house_number,
    property.street_name,
    property.street_type,
    property.city,
  ]
    .filter(Boolean)
    .join(" ");

  if (address) {
    return `${propertyCode || ""} ${address}`.trim();
  }

  return propertyCode || "";
}

function getPropertyAddressLabel(property) {
  if (!property) {
    return "";
  }

  const address = [
    property.house_number,
    property.street_name,
    property.street_type,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (address && property.city) {
    return `${address}, ${property.city}`;
  }

  return (
    address ||
    formatPropertyTextForDisplay(property.display_name) ||
    formatPropertyTextForDisplay(property.display_label) ||
    ""
  );
}

function findPropertyByCode(properties, propertyCode) {
  const normalizedCode = String(propertyCode || "").trim().toUpperCase();

  if (!normalizedCode) {
    return null;
  }

  return (
    (properties || []).find((property) => {
      const savedCode = String(property.property_code || "").trim().toUpperCase();
      const displayCode = formatPropertyCodeForDisplay(savedCode).toUpperCase();

      return (
        savedCode === normalizedCode ||
        displayCode === normalizedCode ||
        (normalizedCode === "PROSPER" && savedCode === "LIVEEC")
      );
    }) || null
  );
}

function formatPropertyCodeForDisplay(propertyCode) {
  const cleanCode = String(propertyCode || "").trim();

  if (cleanCode.toUpperCase() === "LIVEEC") {
    return "PROSPER";
  }

  return cleanCode;
}

function formatPropertyTextForDisplay(value) {
  return String(value || "").replace(/\bLIVEEC\b/gi, "PROSPER");
}

function isProsperOfficeProperty(property) {
  const propertyCode = String(property?.property_code || "").trim().toUpperCase();
  const displayCode = formatPropertyCodeForDisplay(propertyCode).toUpperCase();

  return propertyCode === "LIVEEC" || displayCode === "PROSPER";
}

function removePropertyReviewNotes(reviewNotes) {
  return String(reviewNotes || "")
    .split(";")
    .map((note) => note.trim())
    .filter(Boolean)
    .filter((note) => {
      const lowerNote = note.toLowerCase();
      return (
        !lowerNote.includes("property") &&
        !lowerNote.includes("reference list") &&
        !lowerNote.includes("could not match")
      );
    })
    .join("; ");
}

function buildWorkerMileageEntryUpdatePayload({
  entry,
  form,
  property,
}) {
  const row = entry || {};
  const payload = {};

  setExistingEntryColumns({
    payload,
    row,
    candidates: ["entry_date", "date", "trip_date"],
    value: form.entryDate,
  });

  setExistingEntryColumns({
    payload,
    row,
    candidates: ["vehicle", "vehicle_name", "vehicle_display"],
    value: form.vehicleName,
  });

  setExistingEntryColumns({
    payload,
    row,
    candidates: ["property_code", "property"],
    value: property?.property_code || form.propertyCode,
  });

  setExistingEntryColumns({
    payload,
    row,
    candidates: ["property_display", "property_name"],
    value: getPropertyDisplayLabel(property) || form.propertyCode,
  });

  setExistingEntryColumns({
    payload,
    row,
    candidates: ["start_odometer", "starting_odometer", "start_odo"],
    value: toNumberOrNull(form.startOdometer),
  });

  setExistingEntryColumns({
    payload,
    row,
    candidates: ["end_odometer", "ending_odometer", "end_odo"],
    value: toNumberOrNull(form.endOdometer),
  });

  setExistingEntryColumns({
    payload,
    row,
    candidates: ["miles", "total_miles", "mileage"],
    value: calculateMilesFromOdometer(form.startOdometer, form.endOdometer),
  });

  setExistingEntryColumns({
    payload,
    row,
    candidates: ["purpose", "notes"],
    value: form.purpose || "",
  });

  if (Object.keys(payload).length === 0) {
    payload.entry_date = form.entryDate;
    payload.vehicle = form.vehicleName;
    payload.property_code = property?.property_code || form.propertyCode;
    payload.property_display = getPropertyDisplayLabel(property) || form.propertyCode;
    payload.start_odometer = toNumberOrNull(form.startOdometer);
    payload.end_odometer = toNumberOrNull(form.endOdometer);
    payload.miles = calculateMilesFromOdometer(
      form.startOdometer,
      form.endOdometer
    );
    payload.purpose = form.purpose || "";
  }

  return payload;
}

async function updateMileageEntryRow(entryId, payload) {
  const { data, error } = await supabase
    .from("mileage_entries")
    .update(payload)
    .eq("id", entryId)
    .select("*")
    .maybeSingle();

  if (!error) {
    return data;
  }

  const cleanPayload = { ...payload };
  delete cleanPayload.miles;
  delete cleanPayload.total_miles;
  delete cleanPayload.mileage;

  const canRetryWithoutMiles =
    Object.keys(cleanPayload).length !== Object.keys(payload).length;

  if (canRetryWithoutMiles) {
    const retryResult = await supabase
      .from("mileage_entries")
      .update(cleanPayload)
      .eq("id", entryId)
      .select("*")
      .maybeSingle();

    if (!retryResult.error) {
      return retryResult.data;
    }
  }

  throw error;
}

function setExistingEntryColumns({ payload, row, candidates, value }) {
  candidates.forEach((columnName) => {
    if (hasOwnColumn(row, columnName)) {
      payload[columnName] = value;
    }
  });
}

function hasOwnColumn(row, columnName) {
  return Object.prototype.hasOwnProperty.call(row || {}, columnName);
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isNaN(numberValue) ? null : numberValue;
}

function stringifyValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function getEntryDate(entry) {
  return entry?.entry_date || entry?.date || entry?.trip_date || entry?.created_at || "";
}

function getEntryVehicle(entry) {
  return entry?.vehicle || entry?.vehicle_name || entry?.vehicle_display || "";
}

function getEntryPropertyCode(entry) {
  return formatPropertyCodeForDisplay(entry?.property_code || entry?.property || "");
}

function getEntryPropertyDisplay(entry) {
  return formatPropertyTextForDisplay(
    entry?.property_display ||
      entry?.property_name ||
      formatPropertyCodeForDisplay(entry?.property_code || entry?.property || "") ||
      ""
  );
}

function hasJobberMileage(entry) {
  return Boolean(
    entry?.jobber_visit_id ||
      entry?.jobber_job_id ||
      entry?.jobber_job_title ||
      entry?.jobber_client_name ||
      entry?.jobber_property_address
  );
}

function getMileageSourceLabel(entry) {
  if (entry?.jobber_timesheet_id) return "Jobber Timesheet Entry";
  if (hasJobberMileage(entry)) return "Jobber Visit Entry";
  return "Manual Property Entry";
}

function getResolvedEntryPropertyCode(entry, timesheet, properties = []) {
  const address =
    entry?.jobber_property_address ||
    timesheet?.jobber_property_address ||
    entry?.property_display ||
    "";

  if (hasJobberMileage(entry) || entry?.jobber_timesheet_id) {
    return formatPropertyCodeForDisplay(
      resolvePropertyCode({
        address,
        properties,
        fallbackCode: getEntryPropertyCode(entry),
      })
    );
  }

  return getEntryPropertyCode(entry);
}

function getJobberJobUrl(entry, timesheet) {
  const jobId = entry?.jobber_job_id || timesheet?.jobber_job_id;
  const decodedJobId = getJobberWebRecordId(jobId);

  if (decodedJobId) {
    return `https://secure.getjobber.com/work_orders/${encodeURIComponent(decodedJobId)}`;
  }

  return normalizeStoredJobberUrl(timesheet?.jobber_job_url || entry?.jobber_job_url || "");
}

function getJobberWebRecordId(jobId) {
  if (!jobId) return "";

  const cleanJobId = String(jobId).trim().replace(/^job-/, "");

  try {
    const decodedId = window.atob(cleanJobId);
    return decodedId.split("/").filter(Boolean).at(-1) || cleanJobId;
  } catch {
    return cleanJobId;
  }
}

function normalizeStoredJobberUrl(url) {
  const cleanUrl = String(url || "").trim();
  if (!cleanUrl) return "";

  const rawIdMatch = cleanUrl.match(/\/(?:jobs|work_orders)\/([^/?#]+)/);
  const webId = getJobberWebRecordId(rawIdMatch?.[1] || "");

  if (webId) {
    return `https://secure.getjobber.com/work_orders/${encodeURIComponent(webId)}`;
  }

  return cleanUrl;
}

function getEntryStartOdometer(entry) {
  return entry?.start_odometer ?? entry?.starting_odometer ?? entry?.start_odo ?? "";
}

function getEntryEndOdometer(entry) {
  return entry?.end_odometer ?? entry?.ending_odometer ?? entry?.end_odo ?? "";
}

function getEntryPurpose(entry) {
  return entry?.purpose || entry?.notes || "";
}

function getEntryStatus(entry) {
  return entry?.status || "saved";
}

function getEntryMiles(entry) {
  const start = Number(getEntryStartOdometer(entry));
  const end = Number(getEntryEndOdometer(entry));

  if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
    return end - start;
  }

  const miles = Number(entry?.miles || entry?.total_miles || entry?.mileage);

  if (!Number.isNaN(miles)) {
    return miles;
  }

  return 0;
}

function downloadMileageHistoryCsv(
  entries,
  selectedMonth,
  profile,
  timesheetMap = new Map(),
  properties = []
) {
  if (!entries || entries.length === 0) {
    return;
  }

  const headers = [
    "Date",
    "Source",
    "Vehicle",
    "Timesheet Start",
    "Timesheet End",
    "Timesheet Duration",
    "Timesheet Label",
    "Timesheet Note",
    "Jobber Visit ID",
    "Jobber Timesheet ID",
    "Jobber Job ID",
    "Jobber Job Title",
    "Jobber Job Number",
    "Jobber Client",
    "Jobber Property ID",
    "Jobber Address",
    "Jobber Link",
    "Normal Property",
    "Property Code",
    "Mileage Bucket",
    "Business Category",
    "Purpose",
    "Start Odometer",
    "End Odometer",
    "Miles",
    "Status",
  ];

  const rows = entries.map((entry) => {
    const timesheet = timesheetMap.get(String(entry.jobber_timesheet_id));

    return [
      formatDate(getEntryDate(entry)),
      getMileageSourceLabel(entry),
      formatVehicleNameForDisplay(getEntryVehicle(entry), profile),
      timesheet ? formatDate(timesheet.start_at) + " " + formatTimesheetTime(timesheet.start_at) : "",
      timesheet ? formatDate(timesheet.end_at) + " " + formatTimesheetTime(timesheet.end_at) : "",
      timesheet ? formatTimesheetDuration(timesheet.duration_minutes) : "",
      timesheet?.label || "",
      timesheet?.note || "",
      entry.jobber_visit_id || "",
      entry.jobber_timesheet_id || "",
      entry.jobber_job_id || timesheet?.jobber_job_id || "",
      entry.jobber_job_title || timesheet?.jobber_job_title || "",
      entry.jobber_job_number || timesheet?.jobber_job_number || "",
      entry.jobber_client_name || timesheet?.jobber_client_name || "",
      entry.jobber_property_id || timesheet?.jobber_property_id || "",
      entry.jobber_property_address || timesheet?.jobber_property_address || "",
      getJobberJobUrl(entry, timesheet),
      hasJobberMileage(entry) || entry.jobber_timesheet_id ? "" : getEntryPropertyDisplay(entry),
      getResolvedEntryPropertyCode(entry, timesheet, properties),
      getMileageBucketLabelForEntry(entry, timesheet),
      getBusinessCategoryLabelForEntry(entry, timesheet),
      getEntryPurpose(entry),
      getEntryStartOdometer(entry),
      getEntryEndOdometer(entry),
      getEntryMiles(entry),
      getEntryStatus(entry),
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const fileName = `mileage-history-${selectedMonth || "selected-month"}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  const escapedValue = stringValue.replace(/"/g, '""');

  return `"${escapedValue}"`;
}

function parseMileageDate(dateValue) {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  const stringValue = String(dateValue).trim();

  const dateOnlyMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);

    return new Date(year, month, day);
  }

  const timestampDate = new Date(stringValue);

  if (Number.isNaN(timestampDate.getTime())) {
    return null;
  }

  return timestampDate;
}

function toDateInputString(dateValue) {
  if (!dateValue) return "";

  const stringValue = String(dateValue).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    return stringValue;
  }

  const parsedDate = parseMileageDate(dateValue);

  if (!parsedDate) return "";

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toInputDateValue(dateValue) {
  if (!dateValue) {
    return getTodayInputValue();
  }

  const inputDate = toDateInputString(dateValue);

  return inputDate || getTodayInputValue();
}



function formatMiles(value) {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return "0";
  }

  return numberValue.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function formatDate(dateValue) {
  if (!dateValue) return "—";

  const parsedDate = parseMileageDate(dateValue);

  if (!parsedDate) {
    return dateValue;
  }

  return parsedDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimesheetDate(dateValue) {
  return formatDate(dateValue);
}

function formatTimesheetTime(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
