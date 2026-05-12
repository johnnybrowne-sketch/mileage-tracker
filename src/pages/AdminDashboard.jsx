import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Car,
  ClipboardList,
  Download,
  FileUp,
  Gauge,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Pencil,
  Plus,
  Route,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { signOutUser } from "../services/authService";
import { getProfileForUser } from "../services/profileService";

const logoPaths = [
  "/prosper-logo.svg",
  "/prosper-logo.png",
  "/logo.svg",
  "/logo.png",
];

const navigationItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "mileage", label: "Mileage Review", icon: ClipboardList },
  { id: "add-entry", label: "Admin Add Entry", icon: Plus },
  { id: "workers", label: "Workers", icon: UsersRound },
  { id: "paper-sheets", label: "Paper Sheets", icon: FileUp },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "settings", label: "Settings", icon: Settings },
];

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "saved", label: "Saved" },
  { value: "reviewed", label: "Reviewed" },
  { value: "needs_correction", label: "Needs Correction" },
  { value: "approved", label: "Approved" },
  { value: "finalized", label: "Finalized" },
];

const paperUploadStatusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "uploaded", label: "Uploaded" },
  { value: "received", label: "Received" },
  { value: "reviewing", label: "Reviewing" },
  { value: "converted", label: "Converted" },
  { value: "rejected", label: "Rejected" },
];
const blankEditForm = {
  id: "",
  workerId: "",
  entryDate: "",
  vehicleName: "",
  propertyCode: "",
  startOdometer: "",
  endOdometer: "",
  purpose: "",
  status: "saved",
};

const blankAddForm = {
  workerId: "",
  entryDate: getTodayInputValue(),
  vehicleName: "",
  propertyCode: "",
  startOdometer: "",
  endOdometer: "",
  purpose: "",
  status: "saved",
};

const inputClass =
  "h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const filterClass =
  "h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState("overview");
  const [user, setUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);

  const [workers, setWorkers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [mileageSheets, setMileageSheets] = useState([]);
  const [properties, setProperties] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [selectedWorkerId, setSelectedWorkerId] = useState("all");
  const [selectedVehicle, setSelectedVehicle] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState(blankEditForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const [addForm, setAddForm] = useState(blankAddForm);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  const [messages, setMessages] = useState([]);
  const [selectedMessageWorkerId, setSelectedMessageWorkerId] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState("");

  const [paperUploads, setPaperUploads] = useState([]);
  const [uploadStatusFilter, setUploadStatusFilter] = useState("all");
  const [uploadWorkerFilter, setUploadWorkerFilter] = useState("all");
  const [uploadSearchTerm, setUploadSearchTerm] = useState("");
  const [uploadAdminNotes, setUploadAdminNotes] = useState({});
  const [updatingUploadId, setUpdatingUploadId] = useState("");
  const [paperUploadError, setPaperUploadError] = useState("");
  const [paperUploadSuccess, setPaperUploadSuccess] = useState("");

  const [paperDraftEntries, setPaperDraftEntries] = useState([]);
  const [selectedPaperUploadId, setSelectedPaperUploadId] = useState("");
  const [convertingPaperUploadId, setConvertingPaperUploadId] = useState("");

  const workerMap = useMemo(() => {
    const map = new Map();

    workers.forEach((worker) => {
      if (worker.id) map.set(String(worker.id), worker);
      if (worker.auth_user_id) map.set(String(worker.auth_user_id), worker);
      if (worker.user_id) map.set(String(worker.user_id), worker);
      if (worker.email) map.set(String(worker.email).toLowerCase(), worker);
    });

    return map;
  }, [workers]);

  const monthOptions = useMemo(() => {
    return getMonthOptionsFromEntries(entries);
  }, [entries]);

  const selectedWorker = useMemo(() => {
    if (selectedWorkerId === "all") return null;

    return (
      workers.find((worker) => String(worker.id) === String(selectedWorkerId)) ||
      null
    );
  }, [workers, selectedWorkerId]);

  const reviewVehicleOptions = useMemo(() => {
    return getVehicleOptionsForWorker({
      worker: selectedWorker,
      workers,
      vehicles,
      assignments,
    });
  }, [selectedWorker, workers, vehicles, assignments]);

  const addSelectedWorker = useMemo(() => {
    if (!addForm.workerId) return null;

    return (
      workers.find((worker) => String(worker.id) === String(addForm.workerId)) ||
      null
    );
  }, [workers, addForm.workerId]);

  const addVehicleOptions = useMemo(() => {
    return getVehicleOptionsForWorker({
      worker: addSelectedWorker,
      workers,
      vehicles,
      assignments,
    }).filter((vehicleName) => vehicleName !== "all");
  }, [addSelectedWorker, workers, vehicles, assignments]);

  const driverWorkers = useMemo(() => {
    return workers.filter((worker) => isDriverProfile(worker));
  }, [workers]);

  const selectedMessageWorker = useMemo(() => {
    if (!selectedMessageWorkerId) return null;

    return (
      driverWorkers.find(
        (worker) => String(worker.id) === String(selectedMessageWorkerId)
      ) || null
    );
  }, [driverWorkers, selectedMessageWorkerId]);

  const selectedWorkerMessages = useMemo(() => {
    if (!selectedMessageWorkerId) return [];

    return messages
      .filter((message) => {
        return String(message.worker_id) === String(selectedMessageWorkerId);
      })
      .sort((first, second) => {
        return (
          new Date(first.created_at).getTime() -
          new Date(second.created_at).getTime()
        );
      });
  }, [messages, selectedMessageWorkerId]);

  const filteredPaperUploads = useMemo(() => {
    return paperUploads.filter((upload) => {
      const worker = getWorkerForUpload(upload, workerMap);

      const matchesStatus =
        uploadStatusFilter === "all" || upload.status === uploadStatusFilter;

      const matchesWorker =
        uploadWorkerFilter === "all" ||
        String(upload.worker_id) === String(uploadWorkerFilter);

      const searchText = [
        upload.file_name,
        upload.month_key,
        upload.notes,
        upload.admin_notes,
        upload.status,
        worker?.full_name,
        worker?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !uploadSearchTerm.trim() ||
        searchText.includes(uploadSearchTerm.trim().toLowerCase());

      return matchesStatus && matchesWorker && matchesSearch;
    });
  }, [
    paperUploads,
    workerMap,
    uploadStatusFilter,
    uploadWorkerFilter,
    uploadSearchTerm,
  ]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const worker = getWorkerForEntry(entry, workerMap);
      const entryMonth = getMonthKeyFromDate(getEntryDate(entry));
      const entryStatus = getEntryStatus(entry);

      const matchesMonth =
        selectedMonth === "all" || entryMonth === selectedMonth;

      const matchesWorker =
        selectedWorkerId === "all" ||
        String(worker?.id || getEntryWorkerId(entry)) ===
          String(selectedWorkerId);

      const matchesVehicle =
        selectedVehicle === "all" ||
        vehicleMatchesEntry(getEntryVehicle(entry), selectedVehicle, worker);

      const matchesStatus =
        selectedStatus === "all" ||
        normalizeText(entryStatus) === normalizeText(selectedStatus);

      const searchText = [
        getEntryDate(entry),
        getEntryVehicle(entry),
        getEntryPropertyCode(entry),
        getEntryPropertyDisplay(entry),
        getEntryPurpose(entry),
        getEntryStatus(entry),
        worker?.full_name,
        worker?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchTerm.trim() ||
        searchText.includes(searchTerm.trim().toLowerCase());

      return (
        matchesMonth &&
        matchesWorker &&
        matchesVehicle &&
        matchesStatus &&
        matchesSearch
      );
    });
  }, [
    entries,
    workerMap,
    selectedMonth,
    selectedWorkerId,
    selectedVehicle,
    selectedStatus,
    searchTerm,
  ]);

  const selectedMonthEntries = useMemo(() => {
    return entries.filter((entry) => {
      return getMonthKeyFromDate(getEntryDate(entry)) === selectedMonth;
    });
  }, [entries, selectedMonth]);

  const selectedMonthSummary = useMemo(() => {
    return getMileageSummary(selectedMonthEntries);
  }, [selectedMonthEntries]);

  const filteredSummary = useMemo(() => {
    return getMileageSummary(filteredEntries);
  }, [filteredEntries]);

  const topWorkers = useMemo(() => {
    const totals = new Map();

    selectedMonthEntries.forEach((entry) => {
      const worker = getWorkerForEntry(entry, workerMap);
      const workerId = worker?.id || getEntryWorkerId(entry) || "unknown";

      const current = totals.get(workerId) || {
        worker,
        totalEntries: 0,
        totalMiles: 0,
      };

      current.totalEntries += 1;
      current.totalMiles += getEntryMiles(entry);

      totals.set(workerId, current);
    });

    return Array.from(totals.values())
      .sort((first, second) => second.totalMiles - first.totalMiles)
      .slice(0, 8);
  }, [selectedMonthEntries, workerMap]);

  const addCalculatedMiles = useMemo(() => {
    return calculateMilesFromOdometer(addForm.startOdometer, addForm.endOdometer);
  }, [addForm.startOdometer, addForm.endOdometer]);

  const editCalculatedMiles = useMemo(() => {
    return calculateMilesFromOdometer(
      editForm.startOdometer,
      editForm.endOdometer
    );
  }, [editForm.startOdometer, editForm.endOdometer]);

  useEffect(() => {
    loadAdminDashboard();
  }, []);

  useEffect(() => {
    if (!adminProfile) return undefined;

    let refreshTimer = null;

    function scheduleRealtimeRefresh() {
      window.clearTimeout(refreshTimer);

      refreshTimer = window.setTimeout(() => {
        refreshAllRealtimeData().catch((error) => {
          console.error(error);
          setDataError(
            getFriendlySupabaseError(
              error,
              "Realtime refresh failed. Please check Supabase Realtime and RLS policies."
            )
          );
        });
      }, 250);
    }

    const channel = supabase
      .channel("admin-dashboard-live-sync")
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
        { event: "*", schema: "public", table: "worker_profiles" },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicles" },
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
  }, [adminProfile]);

  useEffect(() => {
    if (selectedVehicle === "all") return;

    const stillValid = reviewVehicleOptions.some((vehicleName) => {
      return vehicleMatchesEntry(vehicleName, selectedVehicle, selectedWorker);
    });

    if (!stillValid) {
      setSelectedVehicle("all");
    }
  }, [reviewVehicleOptions, selectedVehicle, selectedWorker]);

  useEffect(() => {
    if (!addSelectedWorker) {
      setAddForm((currentForm) => ({
        ...currentForm,
        vehicleName: "",
      }));
      return;
    }

    setAddForm((currentForm) => ({
      ...currentForm,
      vehicleName:
        currentForm.vehicleName || getPersonalVehicleName(addSelectedWorker),
    }));
  }, [addSelectedWorker]);

  useEffect(() => {
    if (driverWorkers.length === 0) {
      setSelectedMessageWorkerId("");
      return;
    }

    const selectedWorkerStillExists = driverWorkers.some((worker) => {
      return String(worker.id) === String(selectedMessageWorkerId);
    });

    if (selectedMessageWorkerId && selectedWorkerStillExists) {
      return;
    }

    const workerWithLatestMessage = [...driverWorkers].sort((first, second) => {
      const firstLatest = getLatestMessageForWorker(messages, first.id);
      const secondLatest = getLatestMessageForWorker(messages, second.id);

      return (
        new Date(secondLatest?.created_at || 0).getTime() -
        new Date(firstLatest?.created_at || 0).getTime()
      );
    })[0];

    setSelectedMessageWorkerId(workerWithLatestMessage?.id || driverWorkers[0].id);
  }, [driverWorkers, messages, selectedMessageWorkerId]);

  useEffect(() => {
    if (activeView !== "messages" || !selectedMessageWorkerId) return;

    markSelectedWorkerMessagesRead(selectedMessageWorkerId).catch((error) => {
      console.error(error);
    });
  }, [activeView, selectedMessageWorkerId, selectedWorkerMessages.length]);

  async function loadAdminDashboard() {
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
      const profile = await getProfileForUser(session.user);

      if (!profile) {
        navigate("/onboarding");
        return;
      }

      if (String(profile.role || "").toLowerCase() !== "admin") {
        navigate("/worker");
        return;
      }

      setAdminProfile(profile);

      await refreshAllRealtimeData({ shouldSetMonth: true });
    } catch (error) {
      console.error(error);
      setDataError(
        getFriendlySupabaseError(
          error,
          "Unable to load admin dashboard data. Please check Supabase policies."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshAllRealtimeData(options = {}) {
    const { shouldSetMonth = false } = options;

    const [
      workersResult,
      entriesResult,
      sheetsResult,
      propertiesResult,
      vehiclesResult,
      assignmentsResult,
      messagesResult,
      paperUploadsResult,
      paperDraftEntriesResult,
    ] = await Promise.all([
      supabase
        .from("worker_profiles")
        .select("*")
        .order("full_name", { ascending: true }),

      supabase
        .from("mileage_entries")
        .select("*")
        .order("entry_date", { ascending: false }),

      supabase
        .from("mileage_sheets")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("properties")
        .select("*")
        .order("property_code", { ascending: true }),

      supabase
        .from("vehicles")
        .select("*")
        .order("vehicle_name", { ascending: true }),

      supabase.from("worker_vehicle_assignments").select("*"),

      supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true }),

      supabase
        .from("paper_sheet_uploads")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("paper_sheet_draft_entries")
        .select("*")
        .order("entry_number", { ascending: true }),
    ]);

    if (workersResult.error) throw workersResult.error;
    if (entriesResult.error) throw entriesResult.error;
    if (sheetsResult.error) throw sheetsResult.error;
    if (propertiesResult.error) throw propertiesResult.error;
    if (vehiclesResult.error) throw vehiclesResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;
    if (messagesResult.error) throw messagesResult.error;
    if (paperUploadsResult.error) throw paperUploadsResult.error;
    if (paperDraftEntriesResult.error) throw paperDraftEntriesResult.error;

    const workerRows = workersResult.data || [];
    const entryRows = entriesResult.data || [];
    const sheetRows = sheetsResult.data || [];

    setWorkers(workerRows);
    setEntries(entryRows);
    setMileageSheets(sheetRows);
    setProperties(propertiesResult.data || []);
    setVehicles(vehiclesResult.data || []);
    setAssignments(assignmentsResult.data || []);
    setMessages(messagesResult.data || []);
    setPaperUploads(paperUploadsResult.data || []);
    setPaperDraftEntries(paperDraftEntriesResult.data || []);
    setDataError("");

    if (shouldSetMonth) {
      const availableMonths = getMonthOptionsFromEntries(entryRows);

      if (availableMonths.length > 0) {
        setSelectedMonth(availableMonths[0]);
      }
    }

    return {
      workerRows,
      entryRows,
      sheetRows,
      propertyRows: propertiesResult.data || [],
      vehicleRows: vehiclesResult.data || [],
      assignmentRows: assignmentsResult.data || [],
      messageRows: messagesResult.data || [],
      paperUploadRows: paperUploadsResult.data || [],
      paperDraftEntryRows: paperDraftEntriesResult.data || [],
    };
  }

  async function refreshEntries() {
    const { data, error } = await supabase
      .from("mileage_entries")
      .select("*")
      .order("entry_date", { ascending: false });

    if (error) throw error;

    setEntries(data || []);
    return data || [];
  }

  async function refreshMileageSheets() {
    const { data, error } = await supabase
      .from("mileage_sheets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    setMileageSheets(data || []);
    return data || [];
  }

  async function refreshMessages() {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    setMessages(data || []);
    return data || [];
  }

  async function markSelectedWorkerMessagesRead(workerId) {
    if (!workerId) return;

    const unreadWorkerMessages = messages.filter((message) => {
      return (
        String(message.worker_id) === String(workerId) &&
        message.sender_role === "driver" &&
        message.is_read === false
      );
    });

    if (unreadWorkerMessages.length === 0) return;

    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("worker_id", workerId)
      .eq("sender_role", "driver")
      .eq("is_read", false);

    if (error) throw error;

    setMessages((currentMessages) =>
      currentMessages.map((message) => {
        if (
          String(message.worker_id) === String(workerId) &&
          message.sender_role === "driver"
        ) {
          return { ...message, is_read: true };
        }

        return message;
      })
    );
  }

  function handleWorkerFilterChange(workerId) {
    setSelectedWorkerId(workerId);
    setSelectedVehicle("all");
  }

  function updateAddForm(field, value) {
    setAddForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [field]: value,
      };

      if (field === "workerId") {
        const worker = workers.find((item) => String(item.id) === String(value));

        nextForm.vehicleName = worker ? getPersonalVehicleName(worker) : "";
        nextForm.startOdometer = "";
        nextForm.endOdometer = "";
      }

      if (field === "vehicleName") {
        const worker = workers.find(
          (item) => String(item.id) === String(currentForm.workerId)
        );

        const latestEndOdo = getLatestEndOdometerForWorkerVehicle({
          entries,
          worker,
          vehicleName: value,
          workerMap,
        });

        nextForm.startOdometer = latestEndOdo ? String(latestEndOdo) : "";
        nextForm.endOdometer = "";
      }

      return nextForm;
    });

    setAddError("");
    setAddSuccess("");
  }

  function openEditEntry(entry) {
    const worker = getWorkerForEntry(entry, workerMap);

    setEditingEntry(entry);
    setEditError("");
    setEditSuccess("");

    setEditForm({
      id: entry.id,
      workerId: worker?.id || getEntryWorkerId(entry) || "",
      entryDate: toInputDateValue(getEntryDate(entry)),
      vehicleName: formatVehicleNameForDisplay(getEntryVehicle(entry), worker),
      propertyCode: getEntryPropertyCode(entry),
      startOdometer: stringifyValue(getEntryStartOdometer(entry)),
      endOdometer: stringifyValue(getEntryEndOdometer(entry)),
      purpose: getEntryPurpose(entry),
      status: getEntryStatus(entry),
    });
  }

  function closeEditEntry() {
    setEditingEntry(null);
    setEditForm(blankEditForm);
    setEditError("");
    setEditSuccess("");
  }

  function updateEditForm(field, value) {
    setEditForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [field]: value,
      };

      if (field === "workerId") {
        const worker = workers.find((item) => String(item.id) === String(value));

        nextForm.vehicleName = worker ? getPersonalVehicleName(worker) : "";
      }

      return nextForm;
    });

    setEditError("");
    setEditSuccess("");
  }

  async function handleAddEntry(event) {
    event.preventDefault();

    setSavingAdd(true);
    setAddError("");
    setAddSuccess("");

    try {
      const selectedWorkerForAdd = workers.find(
        (worker) => String(worker.id) === String(addForm.workerId)
      );

      if (!selectedWorkerForAdd) {
        throw new Error("Please select a worker.");
      }

      if (!addForm.vehicleName) {
        throw new Error("Please select a vehicle.");
      }

      const selectedProperty = properties.find(
        (property) => property.property_code === addForm.propertyCode
      );

      if (!selectedProperty) {
        throw new Error("Please select a property from the suggestions.");
      }

      const sheetId = await ensureMileageSheetId({
        sheets: mileageSheets,
        setSheets: setMileageSheets,
        refreshSheets: refreshMileageSheets,
        worker: selectedWorkerForAdd,
        entryDate: addForm.entryDate,
        workers,
      });

      if (!sheetId) {
        throw new Error(
          "A mileage sheet could not be found or created for this worker and month."
        );
      }

      const payload = buildMileagePayloadForSchema({
        entries,
        workers,
        worker: selectedWorkerForAdd,
        form: addForm,
        property: selectedProperty,
        sheetId,
      });

      await insertWithSchemaRetry("mileage_entries", payload);
      await refreshAllRealtimeData();

      setSelectedMonth(getMonthKeyFromDate(addForm.entryDate));
      setSelectedWorkerId(selectedWorkerForAdd.id);
      setSelectedVehicle(addForm.vehicleName);
      setSelectedStatus("all");
      setSearchTerm("");
      setAddSuccess("Mileage entry added successfully.");
      setActiveView("mileage");

      setAddForm({
        ...blankAddForm,
        workerId: selectedWorkerForAdd.id,
        vehicleName: addForm.vehicleName,
        startOdometer: addForm.endOdometer,
        endOdometer: "",
        propertyCode: "",
        purpose: "",
      });
    } catch (error) {
      console.error(error);
      setAddError(getFriendlySupabaseError(error, "Unable to add mileage entry."));
    } finally {
      setSavingAdd(false);
    }
  }

  async function handleUpdateEntry(event) {
    event.preventDefault();

    if (!editingEntry?.id) {
      setEditError("Mileage entry is missing.");
      return;
    }

    setSavingEdit(true);
    setEditError("");
    setEditSuccess("");

    try {
      const selectedWorkerForEdit = workers.find(
        (worker) => String(worker.id) === String(editForm.workerId)
      );

      if (!selectedWorkerForEdit) {
        throw new Error("Please select a worker.");
      }

      const selectedProperty = properties.find(
        (property) => property.property_code === editForm.propertyCode
      );

      if (!selectedProperty) {
        throw new Error("Please select a property from the suggestions.");
      }

      const sheetId = await ensureMileageSheetId({
        sheets: mileageSheets,
        setSheets: setMileageSheets,
        refreshSheets: refreshMileageSheets,
        worker: selectedWorkerForEdit,
        entryDate: editForm.entryDate,
        workers,
      });

      const payload = buildMileagePayloadForSchema({
        entries,
        workers,
        worker: selectedWorkerForEdit,
        form: editForm,
        property: selectedProperty,
        sheetId,
      });

      const completePayload = buildCompleteMileageEntryUpdatePayload({
        basePayload: payload,
        entry: editingEntry,
        workers,
        worker: selectedWorkerForEdit,
        form: editForm,
        property: selectedProperty,
        sheetId,
      });

      const { error } = await supabase
        .from("mileage_entries")
        .update(completePayload)
        .eq("id", editingEntry.id);

      if (error) throw error;

      await refreshAllRealtimeData();

      setEditSuccess("Mileage entry updated successfully.");

      window.setTimeout(() => {
        closeEditEntry();
      }, 650);
    } catch (error) {
      console.error(error);
      setEditError(
        getFriendlySupabaseError(error, "Unable to update mileage entry.")
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteEntry(entryId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this mileage entry?"
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("mileage_entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;

      await refreshAllRealtimeData();
    } catch (error) {
      console.error(error);
      alert(getFriendlySupabaseError(error, "Unable to delete mileage entry."));
    }
  }

  async function handleSendAdminMessage(event) {
    event.preventDefault();

    if (!adminProfile?.id) {
      setMessageError("Admin profile is missing.");
      return;
    }

    if (!selectedMessageWorker?.id) {
      setMessageError("Please select a worker conversation first.");
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
        worker_id: selectedMessageWorker.id,
        sender_id: adminProfile.id,
        sender_role: "admin",
        body: cleanMessage,
      });

      if (error) throw error;

      setMessageDraft("");
      await refreshMessages();
    } catch (error) {
      console.error(error);
      setMessageError(
        getFriendlySupabaseError(
          error,
          "Unable to send message. Please check the messages table RLS policies."
        )
      );
    } finally {
      setSendingMessage(false);
    }
  }

  async function refreshPaperUploads() {
    const { data, error } = await supabase
      .from("paper_sheet_uploads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    setPaperUploads(data || []);
    return data || [];
  }

  async function refreshPaperDraftEntries() {
    const { data, error } = await supabase
      .from("paper_sheet_draft_entries")
      .select("*")
      .order("entry_number", { ascending: true });

    if (error) throw error;

    setPaperDraftEntries(data || []);
    return data || [];
  }

  async function handleConvertPaperUploadAsAdmin(upload) {
    if (!upload?.id) {
      setPaperUploadError("Upload is missing.");
      return;
    }

    setConvertingPaperUploadId(upload.id);
    setPaperUploadError("");
    setPaperUploadSuccess("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "convert-paper-sheet",
        {
          body: {
            uploadId: upload.id,
          },
        }
      );

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      await Promise.all([refreshPaperUploads(), refreshPaperDraftEntries()]);

      setSelectedPaperUploadId(upload.id);
      setPaperUploadSuccess("AI conversion finished. Draft rows are ready for review.");
    } catch (error) {
      console.error(error);
      setPaperUploadError(
        error?.message ||
          "AI conversion failed. Please check the Edge Function logs."
      );
    } finally {
      setConvertingPaperUploadId("");
    }
  }

  async function handleOpenPaperUpload(upload) {
    if (!upload?.file_path) {
      setPaperUploadError("This upload is missing a file path.");
      return;
    }

    setPaperUploadError("");

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
      setPaperUploadError(
        error?.message ||
          "Unable to open file. Please check the paper-sheets storage policies."
      );
    }
  }

  async function handleUpdatePaperUpload(uploadId, updates) {
    setUpdatingUploadId(uploadId);
    setPaperUploadError("");
    setPaperUploadSuccess("");

    try {
      const { error } = await supabase
        .from("paper_sheet_uploads")
        .update(updates)
        .eq("id", uploadId);

      if (error) throw error;

      await refreshPaperUploads();
      setPaperUploadSuccess("Paper sheet upload updated successfully.");

      window.setTimeout(() => {
        setPaperUploadSuccess("");
      }, 1800);
    } catch (error) {
      console.error(error);
      setPaperUploadError(
        getFriendlySupabaseError(
          error,
          "Unable to update paper sheet upload. Please check RLS policies."
        )
      );
    } finally {
      setUpdatingUploadId("");
    }
  }

  async function handleDeletePaperUpload(upload) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this uploaded paper sheet?"
    );

    if (!confirmed) return;

    setUpdatingUploadId(upload.id);
    setPaperUploadError("");
    setPaperUploadSuccess("");

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

      await refreshPaperUploads();
      setPaperUploadSuccess("Paper sheet upload deleted successfully.");

      window.setTimeout(() => {
        setPaperUploadSuccess("");
      }, 1800);
    } catch (error) {
      console.error(error);
      setPaperUploadError(
        error?.message || "Unable to delete the paper sheet upload."
      );
    } finally {
      setUpdatingUploadId("");
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
            Loading admin dashboard...
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
            profile={adminProfile}
            user={user}
            onLogout={handleLogout}
          />
        </aside>

        <section className="min-w-0 flex-1 lg:pl-72">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1900px] items-center justify-between gap-4 px-6 py-4 xl:px-10">
              <div className="flex items-center gap-4">
                <LogoCard
                  wrapperClassName="hidden rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 md:flex"
                  imageClassName="h-10 w-auto object-contain"
                  fallbackClassName="h-10 w-32"
                />

                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-blue-600">
                    Admin Portal
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
                  className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:block"
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

          <div className="mx-auto max-w-[1900px] px-6 py-8 xl:px-10">
            <MobileNav activeView={activeView} setActiveView={setActiveView} />

            {dataError && (
              <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700">
                {dataError}
              </div>
            )}

            {activeView === "overview" && (
              <OverviewView
                profile={adminProfile}
                selectedMonth={selectedMonth}
                selectedMonthSummary={selectedMonthSummary}
                filteredSummary={filteredSummary}
                workers={workers}
                topWorkers={topWorkers}
                recentEntries={selectedMonthEntries.slice(0, 8)}
                workerMap={workerMap}
                setActiveView={setActiveView}
              />
            )}

            {activeView === "mileage" && (
              <MileageReviewView
                entries={filteredEntries}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                monthOptions={monthOptions}
                selectedWorkerId={selectedWorkerId}
                setSelectedWorkerId={handleWorkerFilterChange}
                selectedVehicle={selectedVehicle}
                setSelectedVehicle={setSelectedVehicle}
                vehicleOptions={reviewVehicleOptions}
                selectedStatus={selectedStatus}
                setSelectedStatus={setSelectedStatus}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                workers={workers}
                workerMap={workerMap}
                onEditEntry={openEditEntry}
                onDeleteEntry={handleDeleteEntry}
                editingEntry={editingEntry}
                editForm={editForm}
                updateEditForm={updateEditForm}
                closeEditEntry={closeEditEntry}
                handleUpdateEntry={handleUpdateEntry}
                savingEdit={savingEdit}
                editError={editError}
                editSuccess={editSuccess}
                editCalculatedMiles={editCalculatedMiles}
                properties={properties}
                vehicles={vehicles}
                assignments={assignments}
              />
            )}

            {activeView === "add-entry" && (
              <AdminAddEntryView
                addForm={addForm}
                updateAddForm={updateAddForm}
                handleAddEntry={handleAddEntry}
                savingAdd={savingAdd}
                addError={addError}
                addSuccess={addSuccess}
                addCalculatedMiles={addCalculatedMiles}
                workers={workers}
                properties={properties}
                vehicleOptions={addVehicleOptions}
              />
            )}

            {activeView === "workers" && (
              <WorkersView
                workers={workers}
                entries={entries}
                selectedMonth={selectedMonth}
                workerMap={workerMap}
                setSelectedWorkerId={handleWorkerFilterChange}
                setSelectedVehicle={setSelectedVehicle}
                setActiveView={setActiveView}
              />
            )}

            {activeView === "paper-sheets" && (
              <PaperSheetsReviewView
                uploads={filteredPaperUploads}
                allUploads={paperUploads}
                workers={driverWorkers}
                workerMap={workerMap}
                statusFilter={uploadStatusFilter}
                setStatusFilter={setUploadStatusFilter}
                workerFilter={uploadWorkerFilter}
                setWorkerFilter={setUploadWorkerFilter}
                searchTerm={uploadSearchTerm}
                setSearchTerm={setUploadSearchTerm}
                adminNotes={uploadAdminNotes}
                setAdminNotes={setUploadAdminNotes}
                updatingUploadId={updatingUploadId}
                error={paperUploadError}
                success={paperUploadSuccess}
                draftEntries={paperDraftEntries}
                selectedUploadId={selectedPaperUploadId}
                setSelectedUploadId={setSelectedPaperUploadId}
                convertingUploadId={convertingPaperUploadId}
                onOpenUpload={handleOpenPaperUpload}
                onUpdateUpload={handleUpdatePaperUpload}
                onDeleteUpload={handleDeletePaperUpload}
                onConvertUpload={handleConvertPaperUploadAsAdmin}
              />
            )}

            {activeView === "reports" && (
              <ReportsView
                filteredEntries={filteredEntries}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                monthOptions={monthOptions}
                selectedWorkerId={selectedWorkerId}
                setSelectedWorkerId={handleWorkerFilterChange}
                selectedVehicle={selectedVehicle}
                setSelectedVehicle={setSelectedVehicle}
                selectedStatus={selectedStatus}
                setSelectedStatus={setSelectedStatus}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                workers={workers}
                workerMap={workerMap}
                vehicleOptions={reviewVehicleOptions}
              />
            )}

            {activeView === "messages" && (
              <MessagesView
                adminProfile={adminProfile}
                workers={driverWorkers}
                messages={messages}
                selectedWorkerId={selectedMessageWorkerId}
                setSelectedWorkerId={setSelectedMessageWorkerId}
                selectedWorker={selectedMessageWorker}
                selectedMessages={selectedWorkerMessages}
                messageDraft={messageDraft}
                setMessageDraft={setMessageDraft}
                sendingMessage={sendingMessage}
                messageError={messageError}
                onSendMessage={handleSendAdminMessage}
              />
            )}

            {activeView === "settings" && <SettingsView />}
          </div>
        </section>
      </div>
    </main>
  );
}

function SidebarContent({ activeView, setActiveView, profile, user, onLogout }) {
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
              Admin Portal
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Mileage Review
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Review workers, entries, corrections, and reports.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
              <ShieldCheck size={22} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">
                {profile?.full_name || "Admin"}
              </p>
              <p className="truncate text-xs font-semibold text-slate-500">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black capitalize text-blue-700">
            <BadgeCheck size={14} />
            {profile?.role || "admin"}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <Icon size={19} />
              {item.label}
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

function MobileNav({ activeView, setActiveView }) {
  return (
    <div className="mb-6 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200 lg:hidden">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-black transition ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-slate-50 text-slate-600"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
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

function OverviewView({
  profile,
  selectedMonth,
  selectedMonthSummary,
  filteredSummary,
  workers,
  topWorkers,
  recentEntries,
  workerMap,
  setActiveView,
}) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl">
        <div className="relative p-7 md:p-8">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-20 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-blue-100">
              <ShieldCheck size={16} />
              Live Admin Dashboard
            </div>

            <h2 className="max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
              Welcome, {profile?.full_name || "Admin"}
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Review worker mileage, correct entries, add missing records,
              finalize entries, and download monthly reports. Updates, deletes,
              and new entries sync live through Supabase Realtime.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <HeroMiniStat
                label="Selected Month"
                value={formatMonthKey(selectedMonth)}
                icon={<CalendarDays size={20} />}
              />

              <HeroMiniStat
                label="Month Entries"
                value={selectedMonthSummary.totalEntries}
                icon={<ClipboardList size={20} />}
              />

              <HeroMiniStat
                label="Month Miles"
                value={formatMiles(selectedMonthSummary.totalMiles)}
                icon={<Gauge size={20} />}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-4">
        <KpiCard
          icon={<ClipboardList size={24} />}
          label="Filtered Entries"
          value={filteredSummary.totalEntries}
          helper="Current filters"
        />

        <KpiCard
          icon={<Gauge size={24} />}
          label="Filtered Miles"
          value={formatMiles(filteredSummary.totalMiles)}
          helper="Current filters"
        />

        <KpiCard
          icon={<UsersRound size={24} />}
          label="Workers"
          value={workers.length}
          helper="Worker profiles"
        />

        <KpiCard
          icon={<Car size={24} />}
          label="Avg Miles"
          value={formatMiles(filteredSummary.averageMiles)}
          helper="Per entry"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <SectionTitle
            eyebrow="Quick Actions"
            title="What Would You Like To Review?"
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <QuickActionCard
              icon={<ClipboardList size={24} />}
              title="Mileage Review"
              text="Filter, edit, finalize, delete, and download mileage entries."
              onClick={() => setActiveView("mileage")}
            />

            <QuickActionCard
              icon={<Plus size={24} />}
              title="Add Missing Entry"
              text="Add mileage for a worker who forgot to submit."
              onClick={() => setActiveView("add-entry")}
            />

            <QuickActionCard
              icon={<UsersRound size={24} />}
              title="Workers"
              text="View organized worker mileage totals."
              onClick={() => setActiveView("workers")}
            />

            <QuickActionCard
              icon={<Download size={24} />}
              title="Reports"
              text="Download monthly or filtered reports."
              onClick={() => setActiveView("reports")}
            />
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <SectionTitle eyebrow="Top Workers" title={formatMonthKey(selectedMonth)} />

          <div className="mt-6 space-y-3">
            {topWorkers.length > 0 ? (
              topWorkers.map((item, index) => (
                <div
                  key={item.worker?.id || index}
                  className="flex items-center justify-between gap-4 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white">
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-950">
                        {item.worker?.full_name || "Unknown Worker"}
                      </p>
                      <p className="text-sm text-slate-500">
                        {item.totalEntries} entries
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-black text-slate-950">
                      {formatMiles(item.totalMiles)}
                    </p>
                    <p className="text-xs font-bold text-slate-500">Miles</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No Worker Mileage Yet"
                text="Worker mileage totals will appear here once entries are saved."
              />
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <SectionTitle
          eyebrow="Latest Mileage Activity"
          title={`Recent Entries For ${formatMonthKey(selectedMonth)}`}
        />

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <MileageTable entries={recentEntries} workerMap={workerMap} compact />
        </div>
      </section>
    </div>
  );
}

function MileageReviewView({
  entries,
  selectedMonth,
  setSelectedMonth,
  monthOptions,
  selectedWorkerId,
  setSelectedWorkerId,
  selectedVehicle,
  setSelectedVehicle,
  vehicleOptions,
  selectedStatus,
  setSelectedStatus,
  searchTerm,
  setSearchTerm,
  workers,
  workerMap,
  onEditEntry,
  onDeleteEntry,
  editingEntry,
  editForm,
  updateEditForm,
  closeEditEntry,
  handleUpdateEntry,
  savingEdit,
  editError,
  editSuccess,
  editCalculatedMiles,
  properties,
  vehicles,
  assignments,
}) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 xl:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <SectionTitle
          eyebrow="Mileage Review"
          title="Review, Edit, And Finalize Entries"
          text="This table is scrollable and live synced. If an admin or worker adds, updates, or deletes an entry, the table refreshes automatically."
        />

        <DownloadButton
          entries={entries}
          workerMap={workerMap}
          fileName={`admin-mileage-${selectedMonth || "all"}.csv`}
          label="Download CSV"
        />
      </div>

      <FilterBar
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        monthOptions={monthOptions}
        selectedWorkerId={selectedWorkerId}
        setSelectedWorkerId={setSelectedWorkerId}
        selectedVehicle={selectedVehicle}
        setSelectedVehicle={setSelectedVehicle}
        vehicleOptions={vehicleOptions}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        workers={workers}
      />

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
          workers={workers}
          properties={properties}
          vehicles={vehicles}
          assignments={assignments}
        />
      )}

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
        <MileageTable
          entries={entries}
          workerMap={workerMap}
          onEditEntry={onEditEntry}
          onDeleteEntry={onDeleteEntry}
        />
      </div>
    </section>
  );
}

function AdminAddEntryView({
  addForm,
  updateAddForm,
  handleAddEntry,
  savingAdd,
  addError,
  addSuccess,
  addCalculatedMiles,
  workers,
  properties,
  vehicleOptions,
}) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 md:flex-row md:items-start">
        <SectionTitle
          eyebrow="Admin Add Entry"
          title="Add Mileage For A Worker"
          text="Use this when a worker missed an entry. The app creates or finds the correct mileage sheet first, then saves the mileage entry with the required sheet_id."
          titleClassName="text-3xl"
        />

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Plus size={24} />
        </div>
      </div>

      <form onSubmit={handleAddEntry} className="mt-6 space-y-6">
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
          <h3 className="text-lg font-black text-slate-950">Worker And Trip</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Choose the worker, date, vehicle, property, and reason for the trip.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            <FormField label="Worker">
              <select
                required
                value={addForm.workerId}
                onChange={(event) => updateAddForm("workerId", event.target.value)}
                className={inputClass}
              >
                <option value="">Select Worker</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.full_name || worker.email || "Unnamed Worker"}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Date">
              <input
                type="date"
                required
                value={addForm.entryDate}
                onChange={(event) => updateAddForm("entryDate", event.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Vehicle">
              <select
                required
                value={addForm.vehicleName}
                onChange={(event) =>
                  updateAddForm("vehicleName", event.target.value)
                }
                className={inputClass}
              >
                <option value="">Select Vehicle</option>
                {vehicleOptions.map((vehicleName) => (
                  <option key={vehicleName} value={vehicleName}>
                    {vehicleName}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Status">
              <select
                value={addForm.status}
                onChange={(event) => updateAddForm("status", event.target.value)}
                className={inputClass}
              >
                {statusOptions
                  .filter((status) => status.value !== "all")
                  .map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
              </select>
            </FormField>

            <PropertyAutocomplete
              properties={properties}
              selectedPropertyCode={addForm.propertyCode}
              onSelect={(propertyCode) =>
                updateAddForm("propertyCode", propertyCode)
              }
            />

            <div className="lg:col-span-2">
              <FormField label="Purpose">
                <textarea
                  rows="3"
                  value={addForm.purpose}
                  onChange={(event) =>
                    updateAddForm("purpose", event.target.value)
                  }
                  placeholder="Inspection, maintenance, showing, office errand..."
                  className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </FormField>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
          <h3 className="text-lg font-black text-slate-950">Odometer Details</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Start Odo may auto-fill from the worker’s last saved entry for this
            vehicle. It is still editable.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <OdometerInput
              label="Start Odo"
              value={addForm.startOdometer}
              onChange={(value) => updateAddForm("startOdometer", value)}
              helper="Editable before saving."
            />

            <OdometerInput
              label="End Odo"
              value={addForm.endOdometer}
              onChange={(value) => updateAddForm("endOdometer", value)}
              helper="Enter final odometer."
            />

            <TotalMilesCard calculatedMiles={addCalculatedMiles} />
          </div>
        </div>

        {addError && <AlertBox type="error" message={addError} />}
        {addSuccess && <AlertBox type="success" message={addSuccess} />}

        <div className="flex justify-end border-t border-slate-100 pt-6">
          <button
            type="submit"
            disabled={savingAdd}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-3 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
          >
            <Save size={19} />
            {savingAdd ? "Saving Entry..." : "Save Entry For Worker"}
          </button>
        </div>
      </form>
    </section>
  );
}

function FilterBar({
  selectedMonth,
  setSelectedMonth,
  monthOptions,
  selectedWorkerId,
  setSelectedWorkerId,
  selectedVehicle,
  setSelectedVehicle,
  vehicleOptions,
  selectedStatus,
  setSelectedStatus,
  searchTerm,
  setSearchTerm,
  workers,
}) {
  return (
    <div className="mt-6 grid gap-3 xl:grid-cols-[1fr_1fr_1.25fr_1fr_1.35fr]">
      <select
        value={selectedMonth}
        onChange={(event) => setSelectedMonth(event.target.value)}
        className={filterClass}
      >
        {monthOptions.map((monthKey) => (
          <option key={monthKey} value={monthKey}>
            {formatMonthKey(monthKey)}
          </option>
        ))}
      </select>

      <select
        value={selectedWorkerId}
        onChange={(event) => setSelectedWorkerId(event.target.value)}
        className={filterClass}
      >
        <option value="all">All Workers</option>
        {workers.map((worker) => (
          <option key={worker.id} value={worker.id}>
            {worker.full_name || worker.email || "Unnamed Worker"}
          </option>
        ))}
      </select>

      <select
        value={selectedVehicle}
        onChange={(event) => setSelectedVehicle(event.target.value)}
        className={filterClass}
      >
        {vehicleOptions.map((vehicleName) => (
          <option key={vehicleName} value={vehicleName}>
            {vehicleName === "all" ? "All Vehicles" : vehicleName}
          </option>
        ))}
      </select>

      <select
        value={selectedStatus}
        onChange={(event) => setSelectedStatus(event.target.value)}
        className={filterClass}
      >
        {statusOptions.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>

      <div className="flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
        <Search size={18} className="text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search worker, property, vehicle, purpose..."
          className="w-full border-0 bg-transparent px-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
        />
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
  workers,
  properties,
  vehicles,
  assignments,
}) {
  const selectedWorker = workers.find(
    (worker) => String(worker.id) === String(editForm.workerId)
  );

  const vehicleOptions = getVehicleOptionsForWorker({
    worker: selectedWorker,
    workers,
    vehicles,
    assignments,
  }).filter((vehicleName) => vehicleName !== "all");

  return (
    <div className="mt-6 rounded-[2rem] border border-blue-200 bg-blue-50/50 p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <SectionTitle
          eyebrow="Edit Entry"
          title="Correct Mileage Entry"
          text="Make changes, then save. The update will sync live to other open dashboards."
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
        <div className="grid gap-4 lg:grid-cols-2">
          <FormField label="Date">
            <input
              type="date"
              required
              value={editForm.entryDate}
              onChange={(event) => updateEditForm("entryDate", event.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField label="Worker">
            <select
              required
              value={editForm.workerId}
              onChange={(event) => updateEditForm("workerId", event.target.value)}
              className={inputClass}
            >
              <option value="">Select Worker</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.full_name || worker.email || "Unnamed Worker"}
                </option>
              ))}
            </select>
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
              {vehicleOptions.map((vehicleName) => (
                <option key={vehicleName} value={vehicleName}>
                  {vehicleName}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Status">
            <select
              value={editForm.status}
              onChange={(event) => updateEditForm("status", event.target.value)}
              className={inputClass}
            >
              {statusOptions
                .filter((status) => status.value !== "all")
                .map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
            </select>
          </FormField>

          <PropertyAutocomplete
            properties={properties}
            selectedPropertyCode={editForm.propertyCode}
            onSelect={(propertyCode) =>
              updateEditForm("propertyCode", propertyCode)
            }
          />

          <div className="lg:col-span-2">
            <FormField label="Purpose">
              <textarea
                rows="3"
                value={editForm.purpose}
                onChange={(event) => updateEditForm("purpose", event.target.value)}
                placeholder="Inspection, maintenance, showing, office errand..."
                className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </FormField>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
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
            helper="Update final odometer."
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

function WorkersView({
  workers,
  entries,
  selectedMonth,
  workerMap,
  setSelectedWorkerId,
  setSelectedVehicle,
  setActiveView,
}) {
  const [workerSearch, setWorkerSearch] = useState("");

  const workerSummaries = useMemo(() => {
    return workers
      .map((worker) => {
        const workerEntries = entries.filter((entry) => {
          const entryWorker = getWorkerForEntry(entry, workerMap);
          const entryMonth = getMonthKeyFromDate(getEntryDate(entry));

          return (
            String(entryWorker?.id || getEntryWorkerId(entry)) ===
              String(worker.id) && entryMonth === selectedMonth
          );
        });

        return {
          worker,
          totalEntries: workerEntries.length,
          totalMiles: workerEntries.reduce(
            (total, entry) => total + getEntryMiles(entry),
            0
          ),
          latestEntry: workerEntries[0] || null,
        };
      })
      .filter((summary) => {
        const searchText = [
          summary.worker.full_name,
          summary.worker.email,
          summary.worker.role,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          !workerSearch.trim() ||
          searchText.includes(workerSearch.trim().toLowerCase())
        );
      });
  }, [workers, entries, selectedMonth, workerMap, workerSearch]);

  function reviewWorker(workerId) {
    setSelectedWorkerId(workerId);
    setSelectedVehicle("all");
    setActiveView("mileage");
  }

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 xl:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <SectionTitle
          eyebrow="Workers"
          title="Worker Mileage Summary"
          text={`Organized worker list with mileage totals for ${formatMonthKey(
            selectedMonth
          )}.`}
        />

        <div className="flex h-12 min-w-72 items-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            value={workerSearch}
            onChange={(event) => setWorkerSearch(event.target.value)}
            placeholder="Search workers..."
            className="w-full border-0 bg-transparent px-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
        <div className="max-h-[680px] overflow-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <TableHeader>Worker</TableHeader>
                <TableHeader>Email</TableHeader>
                <TableHeader>Role</TableHeader>
                <TableHeader>Month Entries</TableHeader>
                <TableHeader>Month Miles</TableHeader>
                <TableHeader>Latest Vehicle</TableHeader>
                <TableHeader>Action</TableHeader>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {workerSummaries.map((summary) => (
                <tr key={summary.worker.id} className="bg-white">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <UserRound size={22} />
                      </div>

                      <p className="font-black text-slate-950">
                        {summary.worker.full_name || "Unnamed Worker"}
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {summary.worker.email || "No email"}
                  </td>

                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black capitalize text-blue-700">
                      {summary.worker.role || "driver"}
                    </span>
                  </td>

                  <td className="px-4 py-4 font-black text-slate-950">
                    {summary.totalEntries}
                  </td>

                  <td className="px-4 py-4 font-black text-slate-950">
                    {formatMiles(summary.totalMiles)}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {summary.latestEntry
                      ? formatVehicleNameForDisplay(
                          getEntryVehicle(summary.latestEntry),
                          summary.worker
                        )
                      : "—"}
                  </td>

                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => reviewWorker(summary.worker.id)}
                      className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                    >
                      Review Entries
                    </button>
                  </td>
                </tr>
              ))}

              {workerSummaries.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12">
                    <EmptyState
                      title="No Workers Found"
                      text="Try another search term."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ReportsView({
  filteredEntries,
  selectedMonth,
  setSelectedMonth,
  monthOptions,
  selectedWorkerId,
  setSelectedWorkerId,
  selectedVehicle,
  setSelectedVehicle,
  selectedStatus,
  setSelectedStatus,
  searchTerm,
  setSearchTerm,
  workers,
  workerMap,
  vehicleOptions,
}) {
  const summary = getMileageSummary(filteredEntries);

  const selectedWorker = workers.find(
    (worker) => String(worker.id) === String(selectedWorkerId)
  );

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 xl:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <SectionTitle
          eyebrow="Reports"
          title="Download Mileage Reports"
          text="Filter by month, worker, vehicle, or status. Then download the exact report."
        />

        <DownloadButton
          entries={filteredEntries}
          workerMap={workerMap}
          fileName={buildReportFileName({
            selectedMonth,
            selectedWorker,
            selectedVehicle,
            selectedStatus,
          })}
          label="Download Report CSV"
        />
      </div>

      <FilterBar
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        monthOptions={monthOptions}
        selectedWorkerId={selectedWorkerId}
        setSelectedWorkerId={setSelectedWorkerId}
        selectedVehicle={selectedVehicle}
        setSelectedVehicle={setSelectedVehicle}
        vehicleOptions={vehicleOptions}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        workers={workers}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <KpiCard
          icon={<ClipboardList size={24} />}
          label="Entries To Export"
          value={filteredEntries.length}
          helper="Current filters"
        />

        <KpiCard
          icon={<Gauge size={24} />}
          label="Miles To Export"
          value={formatMiles(summary.totalMiles)}
          helper={formatMonthKey(selectedMonth)}
        />

        <KpiCard
          icon={<Download size={24} />}
          label="File Type"
          value="CSV"
          helper="Excel / Google Sheets"
        />
      </div>

      <div className="mt-6 rounded-[2rem] bg-slate-50 p-5 ring-1 ring-slate-200">
        <h3 className="text-lg font-black text-slate-950">Current Filters</h3>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <ReportFilterLabel label="Month" value={formatMonthKey(selectedMonth)} />

          <ReportFilterLabel
            label="Worker"
            value={
              selectedWorkerId === "all"
                ? "All Workers"
                : selectedWorker?.full_name || "Selected Worker"
            }
          />

          <ReportFilterLabel
            label="Vehicle"
            value={selectedVehicle === "all" ? "All Vehicles" : selectedVehicle}
          />

          <ReportFilterLabel
            label="Status"
            value={
              selectedStatus === "all"
                ? "All Statuses"
                : selectedStatus.replaceAll("_", " ")
            }
          />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
        <MileageTable
          entries={filteredEntries.slice(0, 15)}
          workerMap={workerMap}
          compact
        />
      </div>
    </section>
  );
}

function PaperSheetsReviewView({
  uploads,
  allUploads,
  workers,
  workerMap,
  statusFilter,
  setStatusFilter,
  workerFilter,
  setWorkerFilter,
  searchTerm,
  setSearchTerm,
  adminNotes,
  setAdminNotes,
  updatingUploadId,
  error,
  success,
  draftEntries,
  selectedUploadId,
  setSelectedUploadId,
  convertingUploadId,
  onOpenUpload,
  onUpdateUpload,
  onDeleteUpload,
  onConvertUpload,
}) {
  const totalUploaded = allUploads.length;
  const reviewingCount = allUploads.filter((upload) => {
    return upload.status === "reviewing";
  }).length;
  const convertedCount = allUploads.filter((upload) => {
    return upload.status === "converted";
  }).length;

  const selectedUpload =
    uploads.find((upload) => String(upload.id) === String(selectedUploadId)) ||
    allUploads.find((upload) => String(upload.id) === String(selectedUploadId)) ||
    null;

  const selectedDraftRows = selectedUpload
    ? draftEntries
        .filter((row) => String(row.upload_id) === String(selectedUpload.id))
        .sort((first, second) => {
          return Number(first.entry_number || 0) - Number(second.entry_number || 0);
        })
    : [];

  const selectedDraftTotal = selectedDraftRows.reduce((total, row) => {
    return total + Number(row.miles || 0);
  }, 0);

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 xl:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <SectionTitle
            eyebrow="Paper Sheets"
            title="Uploaded Mileage Sheets"
            text="Review worker-uploaded paper mileage sheets, run AI conversion, open files, update status, and view extracted draft rows."
          />

          <div className="inline-flex h-12 items-center gap-2 rounded-2xl bg-blue-50 px-4 text-sm font-black text-blue-700">
            <FileUp size={18} />
            {totalUploaded} Uploads
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <KpiCard
            icon={<FileUp size={24} />}
            label="Total Uploads"
            value={totalUploaded}
            helper="All paper sheets"
          />

          <KpiCard
            icon={<ClipboardList size={24} />}
            label="Reviewing"
            value={reviewingCount}
            helper="Needs admin review"
          />

          <KpiCard
            icon={<BadgeCheck size={24} />}
            label="Converted"
            value={convertedCount}
            helper="Finished sheets"
          />
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-[1fr_1fr_1.4fr]">
          <select
            value={workerFilter}
            onChange={(event) => setWorkerFilter(event.target.value)}
            className={filterClass}
          >
            <option value="all">All Workers</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.full_name || worker.email || "Unnamed Worker"}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={filterClass}
          >
            {paperUploadStatusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <div className="flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search worker, file, month, notes..."
              className="w-full border-0 bg-transparent px-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {error && <div className="mt-5"><AlertBox type="error" message={error} /></div>}
        {success && <div className="mt-5"><AlertBox type="success" message={success} /></div>}

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <div className="max-h-[720px] overflow-auto">
            <table className="w-full min-w-[1650px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <TableHeader>Uploaded</TableHeader>
                  <TableHeader>Worker</TableHeader>
                  <TableHeader>File</TableHeader>
                  <TableHeader>Month</TableHeader>
                  <TableHeader>AI Status</TableHeader>
                  <TableHeader>Drafts</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Admin Notes</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {uploads.length > 0 ? (
                  uploads.map((upload) => {
                    const worker = getWorkerForUpload(upload, workerMap);
                    const currentAdminNotes =
                      adminNotes[upload.id] ?? upload.admin_notes ?? "";
                    const rowsForUpload = draftEntries.filter((row) => {
                      return String(row.upload_id) === String(upload.id);
                    });
                    const draftTotal = rowsForUpload.reduce((total, row) => {
                      return total + Number(row.miles || 0);
                    }, 0);
                    const isConverting = convertingUploadId === upload.id;

                    return (
                      <tr key={upload.id} className="bg-white">
                        <td className="px-4 py-4">
                          <p className="font-black text-slate-950">
                            {formatDate(upload.created_at)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {formatMessageTime(upload.created_at)}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-black text-slate-950">
                            {worker?.full_name || "Unknown Worker"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {worker?.email || "No email"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="max-w-[240px] truncate font-black text-slate-950">
                            {upload.file_name}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {formatFileSize(upload.file_size)} • {upload.file_type || "file"}
                          </p>
                        </td>

                        <td className="px-4 py-4 font-semibold text-slate-700">
                          {formatPaperUploadMonth(upload.month_key)}
                        </td>

                        <td className="px-4 py-4">
                          <AiStatusBadge status={upload.ai_status} />
                          {upload.ai_error && (
                            <p className="mt-2 max-w-[220px] text-xs font-semibold leading-5 text-red-600">
                              {upload.ai_error}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-black text-slate-950">
                            {rowsForUpload.length} rows
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Draft total: {formatMiles(draftTotal)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Detected total: {formatMiles(upload.total_mileage_detected || 0)}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <select
                            value={upload.status || "uploaded"}
                            disabled={updatingUploadId === upload.id}
                            onChange={(event) =>
                              onUpdateUpload(upload.id, {
                                status: event.target.value,
                              })
                            }
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black capitalize text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {paperUploadStatusOptions
                              .filter((status) => status.value !== "all")
                              .map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                          </select>

                          <div className="mt-2">
                            <PaperUploadStatusBadge status={upload.status} />
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <textarea
                            rows="3"
                            value={currentAdminNotes}
                            onChange={(event) =>
                              setAdminNotes((current) => ({
                                ...current,
                                [upload.id]: event.target.value,
                              }))
                            }
                            placeholder="Add admin notes..."
                            className="w-full min-w-[240px] resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          />

                          <button
                            type="button"
                            disabled={updatingUploadId === upload.id}
                            onClick={() =>
                              onUpdateUpload(upload.id, {
                                admin_notes: currentAdminNotes,
                              })
                            }
                            className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Save Notes
                          </button>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
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
                              disabled={isConverting}
                              onClick={() => onConvertUpload(upload)}
                              className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isConverting ? "Converting..." : "Convert AI"}
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedUploadId(upload.id)}
                              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200"
                            >
                              View Rows
                            </button>

                            <button
                              type="button"
                              disabled={updatingUploadId === upload.id}
                              onClick={() => onDeleteUpload(upload)}
                              className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="px-6 py-12">
                      <EmptyState
                        title="No Paper Sheet Uploads Found"
                        text="Worker uploaded paper mileage sheets will appear here."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedUpload && (
        <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 xl:p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <SectionTitle
              eyebrow="AI Draft Rows"
              title={selectedUpload.file_name}
              text="These are the rows extracted by AI. Workers can edit and submit these as final mileage entries from their dashboard."
            />

            <button
              type="button"
              onClick={() => setSelectedUploadId("")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Close Rows
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <ReportFilterLabel
              label="Detected Total"
              value={formatMiles(selectedUpload.total_mileage_detected || 0)}
            />

            <ReportFilterLabel
              label="Draft Row Total"
              value={formatMiles(selectedDraftTotal)}
            />

            <ReportFilterLabel
              label="Draft Rows"
              value={selectedDraftRows.length}
            />
          </div>

          <div className="mt-6 overflow-auto rounded-3xl border border-slate-200">
            <table className="w-full min-w-[1350px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <TableHeader>Entry #</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Vehicle</TableHeader>
                  <TableHeader>Property Text</TableHeader>
                  <TableHeader>Property Code</TableHeader>
                  <TableHeader>Start Odo</TableHeader>
                  <TableHeader>Ending Odo</TableHeader>
                  <TableHeader>Miles</TableHeader>
                  <TableHeader>Purpose</TableHeader>
                  <TableHeader>Review</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {selectedDraftRows.length > 0 ? (
                  selectedDraftRows.map((row) => (
                    <tr key={row.id} className="bg-white">
                      <td className="px-4 py-4 font-black text-slate-950">
                        {row.entry_number || "—"}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatDate(row.entry_date)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {row.vehicle || "—"}
                      </td>
                      <td className="max-w-[240px] px-4 py-4 text-slate-700">
                        {row.property_text || "—"}
                      </td>
                      <td className="px-4 py-4 font-black text-slate-950">
                        {row.property_code || "—"}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {row.start_odometer || "—"}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {row.end_odometer || "—"}
                      </td>
                      <td className="px-4 py-4 font-black text-slate-950">
                        {formatMiles(row.miles || 0)}
                      </td>
                      <td className="max-w-[320px] px-4 py-4 text-slate-700">
                        {row.purpose || "—"}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                          {row.needs_review ? "Review" : "OK"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" className="px-6 py-12">
                      <EmptyState
                        title="No Draft Rows Yet"
                        text="Run AI conversion to extract editable mileage rows."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
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


function MessagesView({
  adminProfile,
  workers,
  messages,
  selectedWorkerId,
  setSelectedWorkerId,
  selectedWorker,
  selectedMessages,
  messageDraft,
  setMessageDraft,
  sendingMessage,
  messageError,
  onSendMessage,
}) {
  const [workerSearch, setWorkerSearch] = useState("");

  const conversationWorkers = useMemo(() => {
    return workers
      .map((worker) => {
        const workerMessages = messages.filter((message) => {
          return String(message.worker_id) === String(worker.id);
        });

        const latestMessage = workerMessages[workerMessages.length - 1] || null;
        const unreadCount = workerMessages.filter((message) => {
          return message.sender_role === "driver" && message.is_read === false;
        }).length;

        return {
          worker,
          latestMessage,
          unreadCount,
          totalMessages: workerMessages.length,
        };
      })
      .filter((item) => {
        const searchText = [
          item.worker.full_name,
          item.worker.email,
          item.latestMessage?.body,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          !workerSearch.trim() ||
          searchText.includes(workerSearch.trim().toLowerCase())
        );
      })
      .sort((first, second) => {
        const firstTime = new Date(first.latestMessage?.created_at || 0).getTime();
        const secondTime = new Date(second.latestMessage?.created_at || 0).getTime();

        if (second.unreadCount !== first.unreadCount) {
          return second.unreadCount - first.unreadCount;
        }

        return secondTime - firstTime;
      });
  }, [workers, messages, workerSearch]);

  return (
    <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="mb-4 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600">
              <MessageCircle size={28} />
            </div>

            <SectionTitle
              eyebrow="Messages"
              title="Worker Conversations"
              text="Select a worker to view and reply to messages in real time. New worker messages will appear automatically when Supabase Realtime is enabled for the messages table."
            />
          </div>

          <div className="flex h-12 items-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              value={workerSearch}
              onChange={(event) => setWorkerSearch(event.target.value)}
              placeholder="Search workers or messages..."
              className="w-full border-0 bg-transparent px-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="mt-5 max-h-[620px] space-y-3 overflow-y-auto pr-1">
          {conversationWorkers.length > 0 ? (
            conversationWorkers.map((item) => {
              const isActive = String(item.worker.id) === String(selectedWorkerId);

              return (
                <button
                  key={item.worker.id}
                  type="button"
                  onClick={() => setSelectedWorkerId(item.worker.id)}
                  className={`w-full rounded-3xl p-4 text-left ring-1 transition ${
                    isActive
                      ? "bg-blue-600 text-white ring-blue-600 shadow-lg shadow-blue-100"
                      : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-white hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
                          isActive
                            ? "bg-white/15 text-white"
                            : "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
                        }`}
                      >
                        {getInitials(item.worker.full_name || item.worker.email)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-black">
                          {item.worker.full_name || "Unnamed Worker"}
                        </p>
                        <p
                          className={`truncate text-xs font-semibold ${
                            isActive ? "text-blue-100" : "text-slate-500"
                          }`}
                        >
                          {item.worker.email || "No email"}
                        </p>
                      </div>
                    </div>

                    {item.unreadCount > 0 && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                          isActive
                            ? "bg-white text-blue-700"
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        {item.unreadCount}
                      </span>
                    )}
                  </div>

                  <p
                    className={`mt-3 line-clamp-2 text-sm leading-6 ${
                      isActive ? "text-blue-50" : "text-slate-500"
                    }`}
                  >
                    {item.latestMessage?.body || "No messages yet. Start the conversation."}
                  </p>

                  <div
                    className={`mt-3 flex items-center justify-between text-xs font-bold ${
                      isActive ? "text-blue-100" : "text-slate-400"
                    }`}
                  >
                    <span>{item.totalMessages} messages</span>
                    <span>{formatMessageTime(item.latestMessage?.created_at)}</span>
                  </div>
                </button>
              );
            })
          ) : (
            <EmptyState
              title="No Workers Found"
              text="Worker conversations will appear here once worker profiles are available."
            />
          )}
        </div>
      </div>

      <div className="flex min-h-[720px] flex-col rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-black text-blue-700">
              {getInitials(selectedWorker?.full_name || selectedWorker?.email)}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">
                {selectedWorker?.full_name || "Select A Worker"}
              </p>
              <p className="truncate text-xs font-semibold text-slate-500">
                {selectedWorker?.email || "Choose a conversation to begin."}
              </p>
            </div>
          </div>

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            Live Chat
          </span>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-5">
          {selectedWorker ? (
            selectedMessages.length > 0 ? (
              selectedMessages.map((message) => {
                const isAdminMessage = message.sender_role === "admin";

                return (
                  <MessageBubble
                    key={message.id}
                    side={isAdminMessage ? "right" : "left"}
                    name={
                      isAdminMessage
                        ? adminProfile?.full_name || "Admin"
                        : selectedWorker.full_name || "Worker"
                    }
                    text={message.body}
                    createdAt={message.created_at}
                  />
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  title="No Messages Yet"
                  text="Send the first message to start this worker conversation."
                />
              </div>
            )
          ) : (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                title="Select A Worker"
                text="Choose a worker from the left to view or send messages."
              />
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
              disabled={!selectedWorker || sendingMessage}
              placeholder={
                selectedWorker
                  ? `Message ${selectedWorker.full_name || "worker"}...`
                  : "Select a worker first..."
              }
              className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            <button
              type="submit"
              disabled={!selectedWorker || sendingMessage || !messageDraft.trim()}
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

function SettingsView() {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <SectionTitle eyebrow="Settings" title="Admin Settings" />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <SmallInfoCard
          title="Realtime Sync"
          text="Admin and worker entry changes sync through Supabase Realtime after table realtime is enabled."
        />

        <SmallInfoCard
          title="Mileage Status"
          text="Admins can mark entries as saved, reviewed, needs correction, approved, or finalized."
        />

        <SmallInfoCard
          title="Reports"
          text="Download filtered mileage records as spreadsheet-compatible CSV files."
        />
      </div>
    </section>
  );
}

function MileageTable({
  entries,
  workerMap,
  compact = false,
  onEditEntry,
  onDeleteEntry,
}) {
  const tableMinWidth = compact ? "min-w-[1320px]" : "min-w-[1600px]";
  const scrollHeight = compact ? "max-h-[500px]" : "max-h-[720px]";

  if (!entries || entries.length === 0) {
    return (
      <div className={`${scrollHeight} overflow-auto`}>
        <table
          className={`w-full ${tableMinWidth} border-collapse text-left text-sm`}
        >
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <TableHeader>Date</TableHeader>
              <TableHeader>Worker</TableHeader>
              <TableHeader>Vehicle</TableHeader>
              <TableHeader>Property</TableHeader>
              <TableHeader>Purpose</TableHeader>
              <TableHeader>Odometer</TableHeader>
              <TableHeader>Miles</TableHeader>
              <TableHeader>Status</TableHeader>
              {!compact && <TableHeader>Action</TableHeader>}
            </tr>
          </thead>

          <tbody>
            <tr>
              <td colSpan={compact ? "8" : "9"} className="px-6 py-12">
                <EmptyState
                  title="No Entries Found"
                  text="No mileage entries match your current filters."
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={`${scrollHeight} overflow-auto`}>
      <table
        className={`w-full ${tableMinWidth} border-collapse text-left text-sm`}
      >
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <TableHeader>Date</TableHeader>
            <TableHeader>Worker</TableHeader>
            <TableHeader>Vehicle</TableHeader>
            <TableHeader>Property</TableHeader>
            <TableHeader>Purpose</TableHeader>
            <TableHeader>Odometer</TableHeader>
            <TableHeader>Miles</TableHeader>
            <TableHeader>Status</TableHeader>
            {!compact && <TableHeader>Action</TableHeader>}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => {
            const worker = getWorkerForEntry(entry, workerMap);

            return (
              <tr key={entry.id} className="bg-white">
                <td className="px-4 py-4 font-semibold text-slate-700">
                  {formatDate(getEntryDate(entry))}
                </td>

                <td className="px-4 py-4">
                  <p className="font-black text-slate-950">
                    {worker?.full_name || "Unknown Worker"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {worker?.email || "No email"}
                  </p>
                </td>

                <td className="px-4 py-4 text-slate-600">
                  {formatVehicleNameForDisplay(getEntryVehicle(entry), worker)}
                </td>

                <td className="px-4 py-4 text-slate-600">
                  {getEntryPropertyDisplay(entry) ||
                    getEntryPropertyCode(entry) ||
                    "—"}
                </td>

                <td className="max-w-[280px] break-words px-4 py-4 text-slate-600">
                  {getEntryPurpose(entry) || "—"}
                </td>

                <td className="px-4 py-4 text-slate-600">
                  {getEntryStartOdometer(entry) || "—"} →{" "}
                  {getEntryEndOdometer(entry) || "—"}
                </td>

                <td className="px-4 py-4 font-black text-slate-950">
                  {formatMiles(getEntryMiles(entry))}
                </td>

                <td className="px-4 py-4">
                  <StatusBadge status={getEntryStatus(entry)} />
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
            );
          })}
        </tbody>
      </table>
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
      setQuery(getPropertyDisplayLabel(selectedProperty));
    }

    if (!selectedPropertyCode) {
      setQuery("");
    }
  }, [selectedProperty, selectedPropertyCode]);

  const filteredProperties = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) {
      return properties.slice(0, 8);
    }

    return properties
      .filter((property) => {
        const searchText = [
          property.property_code,
          property.house_number,
          property.street_name,
          property.street_type,
          property.city,
          property.zip_code,
          property.display_name,
          property.display_label,
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
    setIsOpen(true);

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
    <div className="relative lg:col-span-2">
      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">
          Property
        </span>

        <p className="mb-2 rounded-2xl bg-blue-50 px-3 py-2 text-xs font-bold leading-5 text-blue-700">
          If the trip is related to Prosper Office work, select LIVEEC as the
          property.
        </p>

        <div className="flex h-12 items-center rounded-2xl border border-slate-300 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus:ring-blue-100">
          <Search size={20} className="text-slate-400" />

          <input
            type="text"
            required
            value={query}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            placeholder="Search by property code, street, house number, or city..."
            className="w-full border-0 bg-transparent px-3 text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      </label>

      {selectedPropertyCode && selectedProperty && (
        <div className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
          Selected: {selectedProperty.property_code}
        </div>
      )}

      {isOpen && (
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
                      {property.property_code}
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

      {isOpen && (
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

function KpiCard({ icon, label, value, helper }) {
  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{helper}</p>
        </div>

        <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">{icon}</div>
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

function DownloadButton({ entries, workerMap, fileName, label }) {
  return (
    <button
      type="button"
      onClick={() =>
        downloadMileageCsv({
          entries,
          workerMap,
          fileName,
        })
      }
      disabled={!entries || entries.length === 0}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download size={17} />
      {label}
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

function SmallInfoCard({ title, text }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
      <h3 className="font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <Route size={28} />
      </div>

      <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const cleanStatus = String(status || "saved").toLowerCase();

  const statusClasses = {
    saved: "bg-emerald-50 text-emerald-700",
    reviewed: "bg-blue-50 text-blue-700",
    approved: "bg-violet-50 text-violet-700",
    finalized: "bg-slate-900 text-white",
    needs_correction: "bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black capitalize ${
        statusClasses[cleanStatus] || statusClasses.saved
      }`}
    >
      {cleanStatus.replaceAll("_", " ")}
    </span>
  );
}

function ReportFilterLabel({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words font-black capitalize text-slate-950">
        {value}
      </p>
    </div>
  );
}

function MessageBubble({ side, name, text, createdAt }) {
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

function getLatestMessageForWorker(messages, workerId) {
  return [...(messages || [])]
    .filter((message) => String(message.worker_id) === String(workerId))
    .sort((first, second) => {
      return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
    })[0];
}

function getInitials(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function isDriverProfile(profile) {
  return String(profile?.role || "driver").toLowerCase() !== "admin";
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

function getWorkerForUpload(upload, workerMap) {
  if (!upload?.worker_id) return null;
  return workerMap.get(String(upload.worker_id)) || null;
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

function getPageTitle(activeView) {
  const item = navigationItems.find((navItem) => navItem.id === activeView);
  return item?.label || "Admin Dashboard";
}

function getEntryWorkerId(entry) {
  return (
    entry.worker_id ||
    entry.worker_profile_id ||
    entry.profile_id ||
    entry.user_id ||
    entry.auth_user_id ||
    ""
  );
}

function getWorkerForEntry(entry, workerMap) {
  const workerId = getEntryWorkerId(entry);

  if (workerMap.get(String(workerId))) {
    return workerMap.get(String(workerId));
  }

  if (entry.email && workerMap.get(String(entry.email).toLowerCase())) {
    return workerMap.get(String(entry.email).toLowerCase());
  }

  if (
    entry.worker_email &&
    workerMap.get(String(entry.worker_email).toLowerCase())
  ) {
    return workerMap.get(String(entry.worker_email).toLowerCase());
  }

  return null;
}

function getEntryDate(entry) {
  return entry.entry_date || entry.date || entry.trip_date || entry.created_at || "";
}

function getEntryVehicle(entry) {
  return entry.vehicle || entry.vehicle_name || entry.vehicle_display || "";
}

function getEntryPropertyCode(entry) {
  return entry.property_code || entry.property || "";
}

function getEntryPropertyDisplay(entry) {
  return entry.property_display || entry.property_name || entry.property_code || "";
}

function getEntryStartOdometer(entry) {
  return entry.start_odometer ?? entry.starting_odometer ?? entry.start_odo ?? "";
}

function getEntryEndOdometer(entry) {
  return entry.end_odometer ?? entry.ending_odometer ?? entry.end_odo ?? "";
}

function getEntryPurpose(entry) {
  return entry.purpose || entry.notes || "";
}

function getEntryStatus(entry) {
  return entry.status || "saved";
}

function getVehicleLabel(vehicle) {
  if (!vehicle) return "";
  return vehicle.display_name || vehicle.vehicle_name || vehicle.name || "";
}

function getPersonalVehicleName(worker) {
  return `Personal - ${worker?.full_name || "Worker"}`;
}

function getVehicleOptionsForWorker({ worker, workers, vehicles, assignments }) {
  const options = ["all"];

  if (worker) {
    options.push(getPersonalVehicleName(worker));

    const assignedVehicleIds = new Set(
      assignments
        .filter((assignment) => String(assignment.worker_id) === String(worker.id))
        .map((assignment) => String(assignment.vehicle_id))
    );

    vehicles.forEach((vehicle) => {
      const vehicleName = getVehicleLabel(vehicle);
      const isCompanyVehicle =
        vehicle.is_company_vehicle === true ||
        String(vehicle.is_company_vehicle).toLowerCase() === "true";

      const isAssigned = assignedVehicleIds.has(String(vehicle.id));

      if (vehicleName && (isCompanyVehicle || isAssigned)) {
        options.push(vehicleName);
      }
    });
  } else {
    vehicles.forEach((vehicle) => {
      const vehicleName = getVehicleLabel(vehicle);
      const isCompanyVehicle =
        vehicle.is_company_vehicle === true ||
        String(vehicle.is_company_vehicle).toLowerCase() === "true";

      if (vehicleName && isCompanyVehicle) {
        options.push(vehicleName);
      }
    });

    workers.forEach((workerItem) => {
      options.push(getPersonalVehicleName(workerItem));
    });
  }

  return Array.from(new Set(options.filter(Boolean))).sort((a, b) => {
    if (a === "all") return -1;
    if (b === "all") return 1;
    return a.localeCompare(b);
  });
}

function formatVehicleNameForDisplay(vehicleName, worker) {
  const cleanVehicleName = String(vehicleName || "").trim();
  const workerName = String(worker?.full_name || "Worker").trim();

  if (!cleanVehicleName) return "";

  const lowerVehicleName = cleanVehicleName.toLowerCase();

  if (lowerVehicleName === "personal") {
    return `Personal - ${workerName}`;
  }

  if (lowerVehicleName.startsWith("personal -")) {
    return cleanVehicleName;
  }

  if (lowerVehicleName.endsWith("- personal")) {
    const ownerName = cleanVehicleName.replace(/\s*-\s*personal$/i, "").trim();
    return `Personal - ${ownerName || workerName}`;
  }

  return cleanVehicleName;
}

function vehicleMatchesEntry(entryVehicle, selectedVehicle, worker) {
  if (selectedVehicle === "all") return true;

  const formattedEntryVehicle = formatVehicleNameForDisplay(entryVehicle, worker);

  if (normalizeText(formattedEntryVehicle) === normalizeText(selectedVehicle)) {
    return true;
  }

  const entryIsPersonal = isPersonalVehicleLabel(entryVehicle);
  const selectedIsPersonal = isPersonalVehicleLabel(selectedVehicle);

  if (entryIsPersonal && selectedIsPersonal && worker) {
    return true;
  }

  return false;
}

function isPersonalVehicleLabel(value) {
  const normalizedValue = normalizeText(value);

  return (
    normalizedValue === "personal" ||
    normalizedValue.startsWith("personal -") ||
    normalizedValue.endsWith("- personal")
  );
}

function getPropertyDisplayLabel(property) {
  if (!property) return "";

  if (property.display_label) return property.display_label;
  if (property.display_name) return property.display_name;

  const address = [
    property.house_number,
    property.street_name,
    property.street_type,
    property.city,
  ]
    .filter(Boolean)
    .join(" ");

  if (address) {
    return `${property.property_code || ""} ${address}`.trim();
  }

  return property.property_code || "";
}

function getMileageSummary(entryRows) {
  const totalEntries = entryRows.length;

  const totalMiles = entryRows.reduce((total, entry) => {
    return total + getEntryMiles(entry);
  }, 0);

  return {
    totalEntries,
    totalMiles,
    averageMiles: totalEntries > 0 ? totalMiles / totalEntries : 0,
  };
}

function getEntryMiles(entry) {
  const start = Number(getEntryStartOdometer(entry));
  const end = Number(getEntryEndOdometer(entry));

  if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
    return end - start;
  }

  const miles = Number(entry.miles || entry.total_miles || entry.mileage);

  if (!Number.isNaN(miles)) {
    return miles;
  }

  return 0;
}

function calculateMilesFromOdometer(startOdometer, endOdometer) {
  const start = Number(startOdometer);
  const end = Number(endOdometer);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }

  return Math.max(end - start, 0);
}

function getLatestEndOdometerForWorkerVehicle({
  entries,
  worker,
  vehicleName,
  workerMap,
}) {
  if (!worker || !vehicleName) return "";

  const sortedEntries = [...entries].sort((a, b) => {
    const dateA = new Date(getEntryDate(a)).getTime();
    const dateB = new Date(getEntryDate(b)).getTime();
    return dateB - dateA;
  });

  const latestEntry = sortedEntries.find((entry) => {
    const entryWorker = getWorkerForEntry(entry, workerMap);

    return (
      String(entryWorker?.id || getEntryWorkerId(entry)) === String(worker.id) &&
      vehicleMatchesEntry(getEntryVehicle(entry), vehicleName, worker) &&
      getEntryEndOdometer(entry)
    );
  });

  return latestEntry ? getEntryEndOdometer(latestEntry) : "";
}

async function ensureMileageSheetId({
  sheets,
  setSheets,
  refreshSheets,
  worker,
  entryDate,
  workers,
}) {
  if (!worker) {
    throw new Error("Please select a worker before saving.");
  }

  const monthKey = getMonthKeyFromDate(entryDate);

  const existingSheet = (sheets || []).find((sheet) => {
    return sheetBelongsToWorker(sheet, worker) && sheetMatchesMonth(sheet, monthKey);
  });

  if (existingSheet?.id) {
    return existingSheet.id;
  }

  const latestSheets = await refreshSheets();

  const latestExistingSheet = (latestSheets || []).find((sheet) => {
    return sheetBelongsToWorker(sheet, worker) && sheetMatchesMonth(sheet, monthKey);
  });

  if (latestExistingSheet?.id) {
    return latestExistingSheet.id;
  }

  const sheetPayload = buildMileageSheetPayload({
    sheets: latestSheets,
    worker,
    entryDate,
    workers,
  });

  const createdSheet = await insertWithSchemaRetry("mileage_sheets", sheetPayload);

  if (!createdSheet?.id) {
    throw new Error("Mileage sheet was created, but no sheet ID was returned.");
  }

  setSheets((currentSheets) => [createdSheet, ...(currentSheets || [])]);

  return createdSheet.id;
}

function buildMileageSheetPayload({ sheets, worker, entryDate, workers }) {
  const sampleSheet = (sheets || []).find(Boolean) || {};
  const hasSampleSheet = Object.keys(sampleSheet).length > 0;

  const monthKey = getMonthKeyFromDate(entryDate);
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const monthName = formatMonthKey(monthKey).replace(` ${year}`, "");

  const payload = {};

  const workerColumn = getWorkerColumn({
    rows: sheets,
    fallback: "user_id",
  });

  const workerValue = getWorkerColumnValue({
    worker,
    workerColumn,
    rows: sheets,
    workers,
  });

  if (workerColumn && workerValue) {
    payload[workerColumn] = workerValue;
  }

  if (!hasSampleSheet) {
    payload.user_id = worker.auth_user_id || worker.user_id || worker.id;
    payload.month = monthNumber;
    payload.year = year;
    payload.status = "open";
    return payload;
  }

  setPayloadColumn({
    payload,
    sampleRow: sampleSheet,
    candidates: ["month_key", "month_year", "period", "period_month", "sheet_month"],
    value: monthKey,
  });

  if (hasOwnColumn(sampleSheet, "month")) {
    payload.month = getSheetMonthValueForSample(sampleSheet.month, monthKey);
  }

  if (hasOwnColumn(sampleSheet, "month_name")) {
    payload.month_name = monthName;
  }

  if (hasOwnColumn(sampleSheet, "year")) {
    payload.year = year;
  }

  if (hasOwnColumn(sampleSheet, "start_date")) {
    payload.start_date = `${monthKey}-01`;
  }

  if (hasOwnColumn(sampleSheet, "month_start")) {
    payload.month_start = `${monthKey}-01`;
  }

  if (hasOwnColumn(sampleSheet, "sheet_date")) {
    payload.sheet_date = `${monthKey}-01`;
  }

  if (hasOwnColumn(sampleSheet, "status")) {
    payload.status = "open";
  }

  if (hasOwnColumn(sampleSheet, "total_miles")) {
    payload.total_miles = 0;
  }

  if (hasOwnColumn(sampleSheet, "total_entries")) {
    payload.total_entries = 0;
  }

  if (hasOwnColumn(sampleSheet, "entry_count")) {
    payload.entry_count = 0;
  }

  return payload;
}

function buildCompleteMileageEntryUpdatePayload({
  basePayload,
  entry,
  workers,
  worker,
  form,
  property,
  sheetId,
}) {
  const row = entry || {};
  const payload = { ...(basePayload || {}) };

  const workerColumns = [
    "worker_id",
    "worker_profile_id",
    "profile_id",
    "user_id",
    "auth_user_id",
  ];

  workerColumns.forEach((columnName) => {
    if (hasOwnColumn(row, columnName)) {
      payload[columnName] = getWorkerColumnValue({
        worker,
        workerColumn: columnName,
        rows: [row],
        workers,
      });
    }
  });

  setExistingMileageColumns({
    payload,
    row,
    candidates: ["sheet_id"],
    value: sheetId,
  });

  setExistingMileageColumns({
    payload,
    row,
    candidates: ["entry_date", "date", "trip_date"],
    value: form.entryDate,
  });

  setExistingMileageColumns({
    payload,
    row,
    candidates: ["vehicle", "vehicle_name", "vehicle_display"],
    value: form.vehicleName,
  });

  setExistingMileageColumns({
    payload,
    row,
    candidates: ["property_code", "property"],
    value: property?.property_code || form.propertyCode,
  });

  setExistingMileageColumns({
    payload,
    row,
    candidates: ["property_display", "property_name"],
    value: getPropertyDisplayLabel(property) || form.propertyCode,
  });

  setExistingMileageColumns({
    payload,
    row,
    candidates: ["start_odometer", "starting_odometer", "start_odo"],
    value: Number(form.startOdometer),
  });

  setExistingMileageColumns({
    payload,
    row,
    candidates: ["end_odometer", "ending_odometer", "end_odo"],
    value: Number(form.endOdometer),
  });

  setExistingMileageColumns({
    payload,
    row,
    candidates: ["miles", "total_miles", "mileage"],
    value: calculateMilesFromOdometer(form.startOdometer, form.endOdometer),
  });

  setExistingMileageColumns({
    payload,
    row,
    candidates: ["purpose", "notes"],
    value: form.purpose || "",
  });

  setExistingMileageColumns({
    payload,
    row,
    candidates: ["status"],
    value: form.status || "saved",
  });

  return payload;
}

function setExistingMileageColumns({ payload, row, candidates, value }) {
  candidates.forEach((columnName) => {
    if (hasOwnColumn(row, columnName)) {
      payload[columnName] = value;
    }
  });
}

function buildMileagePayloadForSchema({
  entries,
  workers,
  worker,
  form,
  property,
  sheetId,
}) {
  const sampleEntry = (entries || []).find(Boolean) || {};
  const hasSampleEntry = Object.keys(sampleEntry).length > 0;

  const payload = {};

  const workerColumn = getWorkerColumn({
    rows: entries,
    fallback: "user_id",
  });

  const workerValue = getWorkerColumnValue({
    worker,
    workerColumn,
    rows: entries,
    workers,
  });

  if (workerColumn && workerValue) {
    payload[workerColumn] = workerValue;
  }

  setMileagePayloadColumn({
    payload,
    sampleEntry,
    hasSampleEntry,
    candidates: ["sheet_id"],
    fallback: "sheet_id",
    value: sheetId,
  });

  setMileagePayloadColumn({
    payload,
    sampleEntry,
    hasSampleEntry,
    candidates: ["entry_date", "date", "trip_date"],
    fallback: "entry_date",
    value: form.entryDate,
  });

  setMileagePayloadColumn({
    payload,
    sampleEntry,
    hasSampleEntry,
    candidates: ["vehicle", "vehicle_name", "vehicle_display"],
    fallback: "vehicle",
    value: form.vehicleName,
  });

  setMileagePayloadColumn({
    payload,
    sampleEntry,
    hasSampleEntry,
    candidates: ["property_code", "property"],
    fallback: "property_code",
    value: property?.property_code || form.propertyCode,
  });

  setMileagePayloadColumn({
    payload,
    sampleEntry,
    hasSampleEntry,
    candidates: ["property_display", "property_name"],
    fallback: "property_display",
    value: getPropertyDisplayLabel(property) || form.propertyCode,
  });

  setMileagePayloadColumn({
    payload,
    sampleEntry,
    hasSampleEntry,
    candidates: ["start_odometer", "starting_odometer", "start_odo"],
    fallback: "start_odometer",
    value: Number(form.startOdometer),
  });

  setMileagePayloadColumn({
    payload,
    sampleEntry,
    hasSampleEntry,
    candidates: ["end_odometer", "ending_odometer", "end_odo"],
    fallback: "end_odometer",
    value: Number(form.endOdometer),
  });

  setMileagePayloadColumn({
    payload,
    sampleEntry,
    hasSampleEntry,
    candidates: ["miles", "total_miles", "mileage"],
    fallback: "miles",
    value: calculateMilesFromOdometer(form.startOdometer, form.endOdometer),
  });

  setMileagePayloadColumn({
    payload,
    sampleEntry,
    hasSampleEntry,
    candidates: ["purpose", "notes"],
    fallback: "purpose",
    value: form.purpose || "",
  });

  setMileagePayloadColumn({
    payload,
    sampleEntry,
    hasSampleEntry,
    candidates: ["status"],
    fallback: "status",
    value: form.status || "saved",
  });

  return payload;
}

function setMileagePayloadColumn({
  payload,
  sampleEntry,
  hasSampleEntry,
  candidates,
  fallback,
  value,
}) {
  const columnName = hasSampleEntry
    ? candidates.find((candidate) => hasOwnColumn(sampleEntry, candidate))
    : fallback;

  if (columnName) {
    payload[columnName] = value;
  }
}

function setPayloadColumn({ payload, sampleRow, candidates, value }) {
  const columnName = candidates.find((candidate) => hasOwnColumn(sampleRow, candidate));

  if (columnName) {
    payload[columnName] = value;
  }
}

function getWorkerColumn({ rows, fallback }) {
  const workerColumns = [
    "worker_id",
    "worker_profile_id",
    "profile_id",
    "user_id",
    "auth_user_id",
  ];

  const sampleRow = (rows || []).find((row) => {
    return workerColumns.some((columnName) => hasOwnColumn(row, columnName));
  });

  if (!sampleRow) {
    return fallback;
  }

  return (
    workerColumns.find((columnName) => hasOwnColumn(sampleRow, columnName)) ||
    fallback
  );
}

function getWorkerColumnValue({ worker, workerColumn, rows, workers }) {
  if (!worker || !workerColumn) return "";

  if (workerColumn === "auth_user_id") {
    return worker.auth_user_id || worker.user_id || worker.id;
  }

  if (workerColumn === "user_id") {
    const userIdUsesWorkerProfileId = (rows || []).some((row) => {
      return (workers || []).some((workerItem) => {
        return String(row.user_id) === String(workerItem.id);
      });
    });

    const userIdUsesAuthUserId = (rows || []).some((row) => {
      return (workers || []).some((workerItem) => {
        return (
          String(row.user_id) ===
          String(workerItem.auth_user_id || workerItem.user_id)
        );
      });
    });

    if (userIdUsesWorkerProfileId) {
      return worker.id;
    }

    if (userIdUsesAuthUserId) {
      return worker.auth_user_id || worker.user_id || worker.id;
    }

    return worker.auth_user_id || worker.user_id || worker.id;
  }

  return worker.id || worker.auth_user_id || worker.user_id;
}

function sheetBelongsToWorker(sheet, worker) {
  if (!sheet || !worker) return false;

  const possibleWorkerValues = [
    worker.id,
    worker.user_id,
    worker.auth_user_id,
    worker.email,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  const possibleSheetValues = [
    sheet.worker_id,
    sheet.worker_profile_id,
    sheet.profile_id,
    sheet.user_id,
    sheet.auth_user_id,
    sheet.email,
    sheet.worker_email,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return possibleSheetValues.some((sheetValue) =>
    possibleWorkerValues.includes(sheetValue)
  );
}

function sheetMatchesMonth(sheet, monthKey) {
  if (!sheet || !monthKey) return false;

  const [yearText, monthText] = monthKey.split("-");
  const monthNumber = Number(monthText);
  const monthName = formatMonthKey(monthKey).replace(` ${yearText}`, "");

  const directMonthFields = [
    sheet.month_key,
    sheet.month_year,
    sheet.period,
    sheet.period_month,
    sheet.sheet_month,
    sheet.month_start,
    sheet.start_date,
    sheet.sheet_date,
    sheet.entry_date,
  ];

  const hasDirectMonthMatch = directMonthFields.some((value) => {
    return getMonthKeyFromDate(value) === monthKey || String(value || "") === monthKey;
  });

  if (hasDirectMonthMatch) return true;

  if (sheet.year && sheet.month) {
    const sheetYear = String(sheet.year);
    const sheetMonthText = String(sheet.month || "").trim();

    if (sheetYear === yearText && Number(sheet.month) === monthNumber) {
      return true;
    }

    if (
      sheetYear === yearText &&
      normalizeText(sheetMonthText).includes(normalizeText(monthName))
    ) {
      return true;
    }
  }

  if (sheet.month) {
    const sheetMonthText = String(sheet.month || "").trim();

    if (sheetMonthText === monthKey || getMonthKeyFromDate(sheetMonthText) === monthKey) {
      return true;
    }

    if (normalizeText(sheetMonthText) === normalizeText(`${monthName} ${yearText}`)) {
      return true;
    }
  }

  return false;
}

async function insertWithSchemaRetry(tableName, initialPayload) {
  let payload = stripUndefinedValues(initialPayload);
  let lastError = null;

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const { data, error } = await supabase
      .from(tableName)
      .insert(payload)
      .select("*")
      .single();

    if (!error) {
      return data;
    }

    lastError = error;

    if (isRowLevelSecurityError(error) || isNotNullViolation(error)) {
      throw error;
    }

    const missingColumn = getMissingColumnFromError(error?.message);

    if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
      const nextPayload = { ...payload };
      delete nextPayload[missingColumn];
      payload = nextPayload;
      continue;
    }

    throw error;
  }

  throw lastError || new Error(`Unable to insert ${tableName}.`);
}

function stripUndefinedValues(payload) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([, value]) => value !== undefined)
  );
}

function getMissingColumnFromError(message) {
  const cleanMessage = String(message || "");

  const schemaCacheMatch = cleanMessage.match(
    /Could not find the '([^']+)' column/i
  );

  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1];
  }

  const missingColumnMatch = cleanMessage.match(
    /column "([^"]+)" (?:does not exist|of relation "[^"]+" does not exist)/i
  );

  return missingColumnMatch?.[1] || "";
}

function isRowLevelSecurityError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("row-level security") || message.includes("rls");
}

function isNotNullViolation(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("null value in column") &&
    message.includes("violates not-null constraint")
  );
}

function getFriendlySupabaseError(error, fallbackMessage) {
  if (isRowLevelSecurityError(error)) {
    return (
      "Supabase blocked this action with Row Level Security. Run the admin RLS policy SQL for mileage_sheets and mileage_entries, then try again. Original error: " +
      (error?.message || "RLS blocked the request.")
    );
  }

  if (isNotNullViolation(error)) {
    return (
      "Supabase rejected the save because a required database column was empty. Original error: " +
      (error?.message || fallbackMessage)
    );
  }

  return error?.message || fallbackMessage;
}

function getSheetMonthValueForSample(sampleMonthValue, monthKey) {
  const [yearText, monthText] = monthKey.split("-");
  const monthNumber = Number(monthText);
  const monthName = formatMonthKey(monthKey).replace(` ${yearText}`, "");
  const sampleText = String(sampleMonthValue || "").trim();

  if (typeof sampleMonthValue === "number") {
    return monthNumber;
  }

  if (/^\d{4}-\d{2}/.test(sampleText)) {
    return monthKey;
  }

  if (/^[a-zA-Z]+\s+\d{4}$/.test(sampleText)) {
    return `${monthName} ${yearText}`;
  }

  if (/^[a-zA-Z]+$/.test(sampleText)) {
    return monthName;
  }

  return String(monthNumber);
}

function hasOwnColumn(row, columnName) {
  return Object.prototype.hasOwnProperty.call(row || {}, columnName);
}

function getCurrentMonthKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthKeyFromDate(dateValue) {
  if (!dateValue) return "";

  if (typeof dateValue === "string" && /^\d{4}-\d{2}/.test(dateValue)) {
    return dateValue.slice(0, 7);
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getMonthOptionsFromEntries(entryRows) {
  const months = (entryRows || [])
    .map((entry) => getMonthKeyFromDate(getEntryDate(entry)))
    .filter(Boolean);

  const currentDate = new Date();

  for (let index = 0; index < 14; index += 1) {
    const date = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - index,
      1
    );

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    months.push(`${year}-${month}`);
  }

  return Array.from(new Set(months)).sort().reverse();
}

function formatMonthKey(monthKey) {
  if (!monthKey || monthKey === "all") {
    return "All Months";
  }

  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function toInputDateValue(dateValue) {
  if (!dateValue) return getTodayInputValue();

  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return getTodayInputValue();
  }

  return date.toISOString().slice(0, 10);
}

function formatDate(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ");
}

function stringifyValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function buildReportFileName({
  selectedMonth,
  selectedWorker,
  selectedVehicle,
  selectedStatus,
}) {
  const monthPart = selectedMonth || "all-months";

  const workerPart = selectedWorker
    ? slugify(selectedWorker.full_name || "worker")
    : "all-workers";

  const vehiclePart =
    selectedVehicle && selectedVehicle !== "all"
      ? slugify(selectedVehicle)
      : "all-vehicles";

  const statusPart =
    selectedStatus && selectedStatus !== "all"
      ? slugify(selectedStatus)
      : "all-statuses";

  return `mileage-report-${monthPart}-${workerPart}-${vehiclePart}-${statusPart}.csv`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function downloadMileageCsv({ entries, workerMap, fileName }) {
  if (!entries || entries.length === 0) return;

  const headers = [
    "Date",
    "Worker",
    "Worker Email",
    "Vehicle",
    "Property Code",
    "Property",
    "Purpose",
    "Start Odometer",
    "End Odometer",
    "Miles",
    "Status",
  ];

  const rows = entries.map((entry) => {
    const worker = getWorkerForEntry(entry, workerMap);

    return [
      formatDate(getEntryDate(entry)),
      worker?.full_name || "",
      worker?.email || "",
      formatVehicleNameForDisplay(getEntryVehicle(entry), worker),
      getEntryPropertyCode(entry),
      getEntryPropertyDisplay(entry),
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

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName || "mileage-report.csv";
  link.click();

  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  const escapedValue = stringValue.replace(/"/g, '""');

  return `"${escapedValue}"`;
}