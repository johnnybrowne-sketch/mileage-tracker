-- Claude paper-sheet scanning metadata and row review notes.

alter table public.paper_sheet_uploads
  add column if not exists ai_provider text,
  add column if not exists ai_model text;

alter table public.paper_sheet_draft_entries
  add column if not exists review_notes text,
  add column if not exists ai_confidence numeric;
