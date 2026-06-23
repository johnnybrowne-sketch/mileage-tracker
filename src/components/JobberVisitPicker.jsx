import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  formatJobberVisitAddress,
  getJobberVisitDisplayLabel,
  mapJobberVisitToMileageFields,
} from "../services/jobberService";

export default function JobberVisitPicker({
  jobberVisits = [],
  selectedJobberVisit,
  setSelectedJobberVisit,
  updateForm,
}) {
  const [query, setQuery] = useState("");

  const filteredVisits = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) {
      return jobberVisits.slice(0, 8);
    }

    return jobberVisits
      .filter((visit) => {
        const searchText = [
          visit.jobber_job_title,
          visit.jobber_client_name,
          visit.jobber_job_number,
          visit.property_address,
          visit.property_city,
          visit.property_state,
          visit.property_postal_code,
          visit.jobber_visit_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(cleanQuery);
      })
      .slice(0, 8);
  }, [jobberVisits, query]);

  function selectVisit(visit) {
    const mappedVisit = mapJobberVisitToMileageFields(visit);

    setSelectedJobberVisit(mappedVisit);
    setQuery(getJobberVisitDisplayLabel(visit));
    updateForm?.(
      "propertyCode",
      visit.jobber_property_id || visit.jobber_visit_id || ""
    );
  }

  function clearVisit() {
    setSelectedJobberVisit(null);
    setQuery("");
    updateForm?.("propertyCode", "");
  }

  return (
    <div className="xl:col-span-2">
      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">
          Jobber Visit / Job
        </span>

        <div className="flex h-12 items-center rounded-2xl border border-slate-300 bg-white px-4">
          <Search size={20} className="text-slate-400" />

          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Jobber visit, client, job, or property..."
            className="w-full border-0 bg-transparent px-3 text-slate-900 outline-none placeholder:text-slate-400"
          />

          {selectedJobberVisit && (
            <button
              type="button"
              onClick={clearVisit}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600"
            >
              Clear
            </button>
          )}
        </div>
      </label>

      {query && filteredVisits.length > 0 && (
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          {filteredVisits.map((visit) => (
            <button
              key={visit.id || visit.jobber_visit_id}
              type="button"
              onClick={() => selectVisit(visit)}
              className="w-full rounded-xl px-4 py-3 text-left hover:bg-blue-50"
            >
              <p className="font-black text-slate-950">
                {visit.jobber_job_title || "Jobber Visit"}
              </p>
              <p className="text-sm font-semibold text-slate-600">
                {visit.jobber_client_name || "No client name"}
              </p>
              <p className="text-sm text-slate-500">
                {formatJobberVisitAddress(visit) || "No property address"}
              </p>
            </button>
          ))}
        </div>
      )}

      {selectedJobberVisit && (
        <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-black">
            {selectedJobberVisit.jobberJobTitle || "Selected Jobber Visit"}
          </p>
          <p>{selectedJobberVisit.jobberClientName || "No client name"}</p>
          <p>{selectedJobberVisit.jobberPropertyAddress || "No property address"}</p>
        </div>
      )}
    </div>
  );
}
