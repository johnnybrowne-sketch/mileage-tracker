import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Bot,
  CalendarDays,
  Car,
  ClipboardList,
  Download,
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
import { signOutUser } from "../services/authService";
import { getProfileForUser } from "../services/profileService";
import { getProperties } from "../services/propertyService";
import { getWorkerVehicles } from "../services/vehicleService";
import {
  calculateEntryMiles,
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

const logoPaths = [
  "/prosper-logo.svg",
  "/prosper-logo.png",
  "/logo.svg",
  "/logo.png",
];

const navigationItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "new-entry", label: "New Mileage Entry", icon: Plus },
  { id: "history", label: "Mileage History", icon: History },
  { id: "upload", label: "Upload Paper Sheet", icon: FileUp },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "help", label: "Help", icon: HelpCircle },
];

const blankForm = {
  entryDate: getTodayInputValue(),
  vehicleId: "",
  propertyCode: "",
  startOdometer: "",
  endOdometer: "",
  purpose: "",
};

const blankEditForm = {
  id: "",
  entryDate: "",
  vehicleName: "",
  propertyCode: "",
  startOdometer: "",
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
  const [properties, setProperties] = useState([]);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  const [form, setForm] = useState(blankForm);
  const [savingEntry, setSavingEntry] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

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

  const calculatedMiles = useMemo(() => {
    return calculateMilesFromOdometer(form.startOdometer, form.endOdometer);
  }, [form.startOdometer, form.endOdometer]);

  const editCalculatedMiles = useMemo(() => {
    return calculateMilesFromOdometer(
      editForm.startOdometer,
      editForm.endOdometer
    );
  }, [editForm.startOdometer, editForm.endOdometer]);

  const monthOptions = useMemo(() => {
    const options = getMonthOptionsFromEntries(entries);

    if (!options.includes(getCurrentMonthKey())) {
      options.unshift(getCurrentMonthKey());
    }

    return Array.from(new Set(options));
  }, [entries]);

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

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!profile?.id) return undefined;

    let refreshTimer = null;

    function scheduleRealtimeRefresh() {
      window.clearTimeout(refreshTimer);

      refreshTimer = window.setTimeout(() => {
        refreshAllWorkerData(profile.id).catch((error) => {
          console.error(error);
          setDataError(
            error?.message ||
              "Realtime refresh failed. Please check Supabase Realtime and RLS policies."
          );
        });
      }, 250);
    }

    const channel = supabase
      .channel(`worker-dashboard-live-sync-${profile.id}`)
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
  }, [profile?.id]);

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
        propertyList,
      } = await refreshAllWorkerData(workerProfile.id);

      if (workerVehicles.length > 0) {
        const defaultVehicle = workerVehicles[0];
        const defaultVehicleName = getWorkerVehicleDisplayName(
          defaultVehicle,
          workerProfile
        );
        const latestEndOdometer = getLatestEndOdometerForVehicle(
          workerEntries,
          defaultVehicleName
        );

        setForm((currentForm) => ({
          ...currentForm,
          vehicleId: defaultVehicle.id,
          startOdometer:
            currentForm.startOdometer || String(latestEndOdometer || ""),
        }));
      }

      const availableMonths = getMonthOptionsFromEntries(workerEntries);

      if (availableMonths.length > 0) {
        setSelectedMonth(availableMonths[0]);
      } else {
        setSelectedMonth(getCurrentMonthKey());
      }
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

  async function refreshAllWorkerData(workerId) {
    const [
      workerEntries,
      workerVehicles,
      propertyList,
      workerMessages,
      workerPaperUploads,
    ] = await Promise.all([
      getWorkerMileageEntries(workerId),
      getWorkerVehicles(workerId),
      getProperties(),
      getWorkerMessages(workerId),
      getWorkerPaperSheetUploads(workerId),
    ]);

    setEntries(workerEntries);
    setVehicles(workerVehicles);
    setProperties(propertyList);
    setMessages(workerMessages);
    setPaperUploads(workerPaperUploads);

    return {
      workerEntries,
      workerVehicles,
      propertyList,
      workerMessages,
      workerPaperUploads,
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
        const selectedVehicle = vehicles.find((vehicle) => vehicle.id === value);
        const selectedVehicleName = getWorkerVehicleDisplayName(
          selectedVehicle,
          profile
        );
        const latestEndOdometer = getLatestEndOdometerForVehicle(
          entries,
          selectedVehicleName
        );

        nextForm.startOdometer = String(latestEndOdometer || "");
        nextForm.endOdometer = "";
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

      const selectedProperty = properties.find(
        (property) => property.property_code === form.propertyCode
      );

      if (!selectedProperty) {
        throw new Error("Please select a property from the suggestions.");
      }

      const savedEntry = await saveWorkerMileageEntry({
        profile,
        entryDate: form.entryDate,
        vehicleName: getWorkerVehicleDisplayName(selectedVehicle, profile),
        propertyCode: selectedProperty?.property_code,
        propertyDisplay:
          selectedProperty?.display_label ||
          selectedProperty?.display_name ||
          selectedProperty?.property_code,
        startOdometer: form.startOdometer,
        endOdometer: form.endOdometer,
        purpose: form.purpose,
      });

      const freshEntries = await refreshEntries(profile.id);
      setSelectedMonth(getMonthKeyFromDate(savedEntry.entry_date));

      setForm((currentForm) => ({
        ...blankForm,
        entryDate: getTodayInputValue(),
        vehicleId: currentForm.vehicleId,
        propertyCode: "",
        startOdometer: currentForm.endOdometer,
        endOdometer: "",
        purpose: "",
      }));

      setFormSuccess(
        "Mileage entry saved successfully. The next start odometer has been filled from your last end odometer."
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

  function openEditEntry(entry) {
    setEditingEntry(entry);
    setEditError("");
    setEditSuccess("");

    setEditForm({
      id: entry.id,
      entryDate: toInputDateValue(entry.entry_date),
      vehicleName: formatVehicleNameForDisplay(entry.vehicle || "", profile),
      propertyCode: entry.property_code || "",
      startOdometer:
        entry.start_odometer !== null && entry.start_odometer !== undefined
          ? String(entry.start_odometer)
          : "",
      endOdometer:
        entry.end_odometer !== null && entry.end_odometer !== undefined
          ? String(entry.end_odometer)
          : "",
      purpose: entry.purpose || "",
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

      const updatePayload = {
        entry_date: editForm.entryDate,
        vehicle: editForm.vehicleName,
        property_code: selectedProperty?.property_code || editForm.propertyCode,
        property_display:
          selectedProperty?.display_label ||
          selectedProperty?.display_name ||
          selectedProperty?.property_code ||
          "",
        start_odometer: Number(editForm.startOdometer),
        end_odometer: Number(editForm.endOdometer),
        purpose: editForm.purpose || "",
      };

      const { error } = await supabase
        .from("mileage_entries")
        .update(updatePayload)
        .eq("id", editingEntry.id);

      if (error) {
        throw error;
      }

      await refreshEntries(profile.id);
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

  function handlePaperSheetFileChange(event) {
    const file = event.target.files?.[0] || null;

    setUploadFile(file);
    setUploadError("");
    setUploadSuccess("");
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
        error?.message ||
          "Unable to upload paper sheet. Please check storage and RLS policies."
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

      await refreshPaperUploads(profile.id);
      setUploadSuccess("Paper sheet upload deleted.");
    } catch (error) {
      console.error(error);
      setUploadError(error?.message || "Unable to delete upload.");
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

          <div className="mx-auto max-w-[1800px] px-6 py-8 xl:px-10">
            <MobileNav activeView={activeView} setActiveView={setActiveView} />

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
                setActiveView={setActiveView}
              />
            )}

            {activeView === "new-entry" && (
              <NewEntryView
                form={form}
                updateForm={updateForm}
                vehicles={vehicles}
                properties={properties}
                calculatedMiles={calculatedMiles}
                savingEntry={savingEntry}
                formError={formError}
                formSuccess={formSuccess}
                onSave={handleSaveEntry}
                profile={profile}
              />
            )}

            {activeView === "history" && (
              <HistoryView
                selectedMonth={selectedMonth}
                monthOptions={monthOptions}
                setSelectedMonth={setSelectedMonth}
                selectedMonthEntries={selectedMonthEntries}
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
                onUpload={handleUploadPaperSheet}
                uploadingSheet={uploadingSheet}
                uploadError={uploadError}
                uploadSuccess={uploadSuccess}
                onOpenUpload={handleOpenPaperUpload}
                onDeleteUpload={handleDeletePaperUpload}
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
      </div>
    </main>
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
              Worker Portal
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Mileage Tracker
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Track daily mileage, history, uploads, and messages.
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
      <div className="mb-3 flex items-center justify-center rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <LogoCard
          wrapperClassName="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200"
          imageClassName="h-10 w-auto object-contain"
          fallbackClassName="h-10 w-24"
        />
      </div>

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

function OverviewView({
  profile,
  user,
  selectedMonth,
  selectedMonthEntries,
  selectedMonthSummary,
  activeVehicle,
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
              <Sparkles size={16} />
              Live Dashboard Overview
            </div>

            <h2 className="max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
              Welcome, {profile?.full_name || user?.email}
            </h2>

            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Review your mileage activity, add entries, upload paper sheets,
              and message admin from one organized dashboard. Entries update live
              when you or admin make changes.
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
          value="Soon"
          helper="AI conversion workflow"
          accent="violet"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <SectionTitle
            eyebrow="Quick Actions"
            title="What Would You Like To Do?"
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <QuickActionCard
              icon={<Plus size={24} />}
              title="Add Mileage"
              text="Create a new daily mileage entry."
              onClick={() => setActiveView("new-entry")}
            />

            <QuickActionCard
              icon={<FileUp size={24} />}
              title="Upload Sheet"
              text="Upload a paper form for AI conversion."
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

function NewEntryView({
  form,
  updateForm,
  vehicles,
  properties,
  calculatedMiles,
  savingEntry,
  formError,
  formSuccess,
  onSave,
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
              </select>
            </FormField>

            <PropertyAutocomplete
              properties={properties}
              selectedPropertyCode={form.propertyCode}
              onSelect={(propertyCode) =>
                updateForm("propertyCode", propertyCode)
              }
            />

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
          description="Start Odometer is auto-filled from the last saved end odometer when available, but it is always editable."
        >
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

        <div className="flex justify-end border-t border-slate-100 pt-6">
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
    </section>
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
    <div className="relative xl:col-span-2">
      <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="text-sm font-black text-amber-900">
          Prosper Office Mileage Note
        </p>
        <p className="mt-1 text-sm leading-6 text-amber-800">
          If this trip is related to Prosper Office work, select{" "}
          <span className="font-black">LIVEEC</span> as the property. This helps
          assign the mileage correctly to Prosper Office.
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

function HistoryView({
  selectedMonth,
  monthOptions,
  setSelectedMonth,
  selectedMonthEntries,
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
  properties,
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
                profile
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
  onUpload,
  uploadingSheet,
  uploadError,
  uploadSuccess,
  onOpenUpload,
  onDeleteUpload,
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600">
          <FileUp size={28} />
        </div>

        <SectionTitle
          eyebrow="Paper Sheet Upload"
          title="Upload Mileage Form"
          text="Upload a photo or PDF of a paper mileage sheet. Admin will review it and update the status in real time."
        />

        <form onSubmit={onUpload} className="mt-6 space-y-5">
          <div className="rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-6 text-center">
            <FileUp className="mx-auto text-blue-600" size={42} />

            <h3 className="mt-4 text-lg font-black text-slate-950">
              Choose Paper Sheet File
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Accepted file types: JPG, PNG, WEBP, or PDF. Maximum file size is
              10 MB.
            </p>

            <input
              id="paper-sheet-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
              onChange={onFileChange}
              className="mt-6 block w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-bold file:text-white"
            />

            {uploadFile && (
              <div className="mt-4 rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200">
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

          <div className="grid gap-4 lg:grid-cols-2">
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
              rows="5"
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
        </form>
      </div>

      <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <SectionTitle
          eyebrow="Upload History"
          title="Your Paper Sheets"
          text="Track submitted paper sheets and review admin status updates."
        />

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <div className="max-h-[680px] overflow-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <TableHeader>Uploaded</TableHeader>
                  <TableHeader>File</TableHeader>
                  <TableHeader>Month</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Notes</TableHeader>
                  <TableHeader>Admin Notes</TableHeader>
                  <TableHeader>Action</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {uploads.length > 0 ? (
                  uploads.map((upload) => (
                    <tr key={upload.id} className="bg-white">
                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {formatDate(upload.created_at)}
                      </td>

                      <td className="px-4 py-4">
                        <p className="max-w-[220px] truncate font-black text-slate-950">
                          {upload.file_name}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {formatFileSize(upload.file_size)}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {formatPaperUploadMonth(upload.month_key)}
                      </td>

                      <td className="px-4 py-4">
                        <PaperUploadStatusBadge status={upload.status} />
                      </td>

                      <td className="max-w-[240px] px-4 py-4 text-slate-600">
                        <p className="line-clamp-4 leading-6">
                          {upload.notes || "—"}
                        </p>
                      </td>

                      <td className="max-w-[240px] px-4 py-4 text-slate-600">
                        <p className="line-clamp-4 leading-6">
                          {upload.admin_notes || "—"}
                        </p>
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
                            onClick={() => onDeleteUpload(upload)}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="mx-auto max-w-sm">
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
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
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

  const unreadAdminCount = useMemo(() => {
    return sortedMessages.filter((message) => {
      return message.sender_role === "admin" && message.is_read === false;
    }).length;
  }, [sortedMessages]);

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

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-950">
                  Conversation Status
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-600">
                  Real-time messaging enabled
                </p>
              </div>

              {unreadAdminCount > 0 && (
                <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">
                  {unreadAdminCount} new
                </span>
              )}
            </div>
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
    <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <SectionTitle eyebrow="Help" title="Mileage Tracker Help" />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <SmallInfoCard
          title="Mileage Entries"
          text="Use the New Mileage Entry section to add daily mileage records."
        />

        <SmallInfoCard
          title="Paper Sheets"
          text="Use Upload Paper Sheet when you want AI to convert a scanned form."
        />

        <SmallInfoCard
          title="Admin Chat"
          text="Use Messages to ask admin about corrections or missing details."
        />
      </div>
    </section>
  );
}

function MileageTable({
  entries,
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
                {formatDate(entry.entry_date)}
              </td>

              <td className="px-4 py-4 text-slate-600">
                {formatVehicleNameForDisplay(entry.vehicle || "—", profile)}
              </td>

              <td className="px-4 py-4 text-slate-600">
                {entry.property_display || entry.property_code || "—"}
              </td>

              <td className="max-w-[340px] px-4 py-4 text-slate-600">
                <p className="line-clamp-3 leading-6">
                  {entry.purpose || "—"}
                </p>
              </td>

              <td className="px-4 py-4 font-black text-slate-950">
                {formatMiles(calculateEntryMiles(entry))}
              </td>

              <td className="px-4 py-4">
                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black capitalize text-emerald-700">
                  {entry.status || "saved"}
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
      vehicleLabelsMatch(entry.vehicle, vehicleName) &&
      entry.end_odometer !== null &&
      entry.end_odometer !== undefined &&
      entry.end_odometer !== ""
    );
  });

  return latestMatchingEntry?.end_odometer || "";
}

function getPropertyDisplayLabel(property) {
  if (!property) {
    return "";
  }

  if (property.display_label) {
    return property.display_label;
  }

  if (property.display_name) {
    return property.display_name;
  }

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

function downloadMileageHistoryCsv(entries, selectedMonth, profile) {
  if (!entries || entries.length === 0) {
    return;
  }

  const headers = [
    "Date",
    "Vehicle",
    "Property Code",
    "Property",
    "Purpose",
    "Start Odometer",
    "End Odometer",
    "Miles",
    "Status",
  ];

  const rows = entries.map((entry) => [
    formatDate(entry.entry_date),
    formatVehicleNameForDisplay(entry.vehicle || "", profile),
    entry.property_code || "",
    entry.property_display || "",
    entry.purpose || "",
    entry.start_odometer || "",
    entry.end_odometer || "",
    calculateEntryMiles(entry),
    entry.status || "saved",
  ]);

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

function toInputDateValue(dateValue) {
  if (!dateValue) {
    return getTodayInputValue();
  }

  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return getTodayInputValue();
  }

  return date.toISOString().slice(0, 10);
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