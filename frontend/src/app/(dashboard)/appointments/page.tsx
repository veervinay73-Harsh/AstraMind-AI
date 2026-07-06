"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  User,
  Stethoscope,
  Phone,
  Mail,
  History,
  FileText,
  AlertCircle,
  RefreshCw,
  X,
  Link as LinkIcon
} from "lucide-react";

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  age: number | null;
  gender: string | null;
  isNewPatient: boolean | null;
  insuranceDetails: string | null;
}

interface Doctor {
  id: string;
  name: string;
  specialization: string;
}

interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  dateTime: string;
  status: string;
  notes: string | null;
  department: string | null;
  reasonForVisit: string | null;
  symptoms: string | null;
  hospitalId: string;
  callLogId: string | null;
  patient: Patient;
  doctor: Doctor;
  createdAt: string;
  updatedAt: string;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and Query States
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState("asc");
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Details Drawer State
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  const fetchDoctors = async () => {
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL ? (process.env.NEXT_PUBLIC_API_URL.endsWith('/api') ? process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') + '/api') : "http://localhost:5000/api");
      const res = await fetch(`${baseUrl}/doctors?limit=100`);
      if (res.ok) {
        const raw = await res.json();
        // Defensive: handle both { doctors: [] } shape and direct array
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.doctors) ? raw.doctors : [];
        setDoctorsList(list);
      }
    } catch (err) {
      console.error("Failed to load doctors list for filter dropdown", err);
    }
  };

  const fetchAppointments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL ? (process.env.NEXT_PUBLIC_API_URL.endsWith('/api') ? process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') + '/api') : "http://localhost:5000/api");
      
      const queryParams = new URLSearchParams({
        hospitalId: "default", // will be auto-resolved by backend fallback
        page: page.toString(),
        limit: limit.toString(),
        sort,
        ...(search && { search }),
        ...(status && { status }),
        ...(doctorId && { doctorId }),
        ...(date && { date }),
      });

      const res = await fetch(`${baseUrl}/appointments?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load appointments from server.");
      }
      
      const data = await res.json();
      setAppointments(Array.isArray(data?.appointments) ? data.appointments : []);
      setTotalPages(data?.pagination?.totalPages ?? 1);
      setTotalRecords(data?.pagination?.total ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred while fetching appointments.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch doctors list once
  useEffect(() => {
    fetchDoctors();
  }, []);

  // Re-fetch appointments when filters / queries change
  useEffect(() => {
    fetchAppointments();
    const handleRefresh = () => fetchAppointments();
    window.addEventListener("refresh_dashboard", handleRefresh);
    return () => window.removeEventListener("refresh_dashboard", handleRefresh);
  }, [search, status, doctorId, date, sort, page]);

  // Reset page to 1 when filters are changed
  const handleFilterChange = (setter: (val: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  // Clear all filters
  const handleResetFilters = () => {
    setSearch("");
    setStatus("");
    setDoctorId("");
    setDate("");
    setSort("asc");
    setPage(1);
  };

  return (
    <div className="space-y-6 relative min-h-screen pb-16">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Appointments</h1>
        <p className="text-sm text-zinc-500">Manage patient booking status, schedule slots, and doctor workloads.</p>
      </div>

      {/* API Error Alert */}
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 text-sm text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAppointments}
            className="flex items-center gap-1 text-xs font-semibold hover:underline bg-rose-100 dark:bg-rose-900/40 px-2.5 py-1 rounded-md"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Filters, Sorting & Searching Controls */}
      <div className="space-y-4 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
        
        {/* Row 1: Search & Reset */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleFilterChange(setSearch, e.target.value)}
              placeholder="Search by patient, phone number, or doctor..."
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm placeholder-zinc-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={handleResetFilters}
            className="h-9 px-4 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            Reset Filters
          </button>
        </div>

        {/* Row 2: Select Filters */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 text-xs font-medium">
          
          {/* Filter by Status */}
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 font-semibold mb-0.5">Status</label>
            <select
              value={status}
              onChange={(e) => handleFilterChange(setStatus, e.target.value)}
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="RESCHEDULED">Rescheduled</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Filter by Doctor */}
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 font-semibold mb-0.5">Doctor</label>
            <select
              value={doctorId}
              onChange={(e) => handleFilterChange(setDoctorId, e.target.value)}
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Doctors</option>
              {(Array.isArray(doctorsList) ? doctorsList : []).map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.name} ({doc.specialization})</option>
              ))}
            </select>
          </div>

          {/* Filter by Date */}
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 font-semibold mb-0.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleFilterChange(setDate, e.target.value)}
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Sort by Date Order */}
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 font-semibold mb-0.5">Order (Date)</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="asc">Ascending (Earlier first)</option>
              <option value="desc">Descending (Latest first)</option>
            </select>
          </div>

        </div>

      </div>

      {/* Appointments List Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-xs">
        {isLoading ? (
          // Loading Skeletons
          <div className="divide-y divide-zinc-100 dark:divide-zinc-900 p-4 space-y-4">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2.5 animate-pulse">
                <div className="space-y-1.5 flex-1 max-w-sm">
                  <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-3 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
                <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded mr-10" />
                <div className="h-6 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
              </div>
            ))}
          </div>
        ) : appointments.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center text-center p-12 text-zinc-400">
            <Calendar className="h-10 w-10 text-zinc-300 mb-2" />
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No Appointments Found</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Try adjusting your search criteria, clearing the filters, or verifying your system connection.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="p-4">Patient Info</th>
                  <th className="p-4">Doctor (Specialization)</th>
                  <th className="p-4">Date / Time</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Created Time</th>
                  <th className="p-4">Updated Time</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-sm">
                {appointments.map((appt) => {
                  const apptDateObj = new Date(appt.dateTime);
                  const formattedDate = apptDateObj.toLocaleDateString([], {
                    year: 'numeric', month: 'short', day: 'numeric'
                  });
                  const formattedTime = apptDateObj.toLocaleTimeString([], {
                    hour: '2-digit', minute: '2-digit'
                  });

                  return (
                    <tr 
                      key={appt.id} 
                      onClick={() => setSelectedAppt(appt)}
                      className="hover:bg-zinc-50/40 dark:hover:bg-zinc-900/10 transition-colors cursor-pointer"
                    >
                      <td className="p-4">
                        <p className="font-semibold text-zinc-900 dark:text-white">{appt.patient?.name}</p>
                        <p className="text-xs text-zinc-500">{appt.patient?.phone}</p>
                      </td>
                      <td className="p-4 text-zinc-700 dark:text-zinc-300 font-medium">
                        <div>{appt.doctor?.name}</div>
                        <div className="text-xs text-zinc-500 font-normal">{appt.doctor?.specialization}</div>
                      </td>
                      <td className="p-4 text-zinc-700 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{formattedDate}</span>
                          <span className="text-zinc-400">•</span>
                          <span>{formattedTime}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          appt.status === "CONFIRMED" 
                            ? "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400"
                            : appt.status === "RESCHEDULED"
                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                            : appt.status === "CANCELLED"
                            ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                            : appt.status === "DOCTOR_CHANGED"
                            ? "bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400"
                            : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400"
                        }`}>
                          {appt.status === "CONFIRMED" && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {appt.status === "RESCHEDULED" && <Clock className="h-3.5 w-3.5 animate-pulse" />}
                          {appt.status === "CANCELLED" && <XCircle className="h-3.5 w-3.5" />}
                          {appt.status === "PENDING" && <Clock className="h-3.5 w-3.5" />}
                          {appt.status === "DOCTOR_CHANGED" && <Stethoscope className="h-3.5 w-3.5" />}
                          <span>{appt.status.toLowerCase().replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="p-4 text-zinc-700 dark:text-zinc-300 text-xs">
                        {new Date(appt.createdAt).toLocaleString([], { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 text-zinc-700 dark:text-zinc-300 text-xs">
                        {new Date(appt.updatedAt).toLocaleString([], { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 text-right">
                        <button className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 hover:text-zinc-600">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && totalRecords > 0 && (
          <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-900 px-6 py-4">
            <span className="text-xs text-zinc-500">
              Showing page <strong className="text-zinc-900 dark:text-white">{page}</strong> of <strong className="text-zinc-900 dark:text-white">{totalPages}</strong> ({totalRecords} records)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* APPOINTMENT DETAILS DRAWER */}
      {selectedAppt && (
        <>
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setSelectedAppt(null)}
          />

          {/* Slide-out Drawer Panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col p-6 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-4 mb-5 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Appointment Details</h2>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">ID: {selectedAppt.id}</p>
              </div>
              <button
                onClick={() => setSelectedAppt(null)}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-100 dark:border-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable details content */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1 text-sm">
              
              {/* Section 1: Patient Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <User className="h-4 w-4 text-indigo-500" />
                  <span>Patient Information</span>
                </h3>
                <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Full Name</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">{selectedAppt.patient?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Phone Number</span>
                    <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-zinc-400" />
                      {selectedAppt.patient?.phone}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Email Address</span>
                    <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-zinc-400" />
                      {selectedAppt.patient?.email || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Age</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {selectedAppt.patient?.age || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Gender</span>
                    <span className="font-semibold text-zinc-900 dark:text-white capitalize">
                      {selectedAppt.patient?.gender || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Patient Type</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {selectedAppt.patient?.isNewPatient === null || selectedAppt.patient?.isNewPatient === undefined ? "N/A" : (selectedAppt.patient.isNewPatient ? "New Patient" : "Existing Patient")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Insurance</span>
                    <span className="font-semibold text-zinc-900 dark:text-white truncate max-w-[200px]" title={selectedAppt.patient?.insuranceDetails || "N/A"}>
                      {selectedAppt.patient?.insuranceDetails || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Appointment Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Stethoscope className="h-4 w-4 text-indigo-500" />
                  <span>Appointment Information</span>
                </h3>
                <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Doctor Assigned</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">{selectedAppt.doctor?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Department</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">{selectedAppt.department || selectedAppt.doctor?.specialization || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Reason for Visit</span>
                    <span className="font-semibold text-zinc-900 dark:text-white truncate max-w-[200px]" title={selectedAppt.reasonForVisit || "N/A"}>
                      {selectedAppt.reasonForVisit || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Symptoms</span>
                    <span className="font-semibold text-zinc-900 dark:text-white truncate max-w-[200px]" title={selectedAppt.symptoms || "N/A"}>
                      {selectedAppt.symptoms || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Date</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {new Date(selectedAppt.dateTime).toLocaleDateString([], {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Time Slot</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {new Date(selectedAppt.dateTime).toLocaleTimeString([], {
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                   <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Current Status</span>
                    <span className="capitalize font-semibold text-indigo-500">{selectedAppt.status.toLowerCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Created Time</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {new Date(selectedAppt.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Updated Time</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {new Date(selectedAppt.updatedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: AI Speech/Transcript Summary */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  <span>AI Conversation Summary</span>
                </h3>
                <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 p-4">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed italic">
                    "Patient called in seeking a slot. The AI receptionist detected the slot requirements, resolved availability for {selectedAppt.doctor?.name} in {selectedAppt.doctor?.specialization}, confirmed patient name as {selectedAppt.patient?.name}, and created the booking record."
                  </p>
                </div>
              </div>

              {/* Section 4: History / Audit Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <History className="h-4 w-4 text-indigo-500" />
                  <span>Booking Logs</span>
                </h3>
                <div className="relative border-l border-zinc-100 dark:border-zinc-800 ml-2.5 pl-4 space-y-3 text-xs">
                  <div className="relative">
                    <span className="absolute -left-[20px] top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-500" />
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">Status marked as {selectedAppt.status}</p>
                    <p className="text-[10px] text-zinc-400">{new Date(selectedAppt.dateTime).toLocaleString()}</p>
                  </div>
                  <div className="relative">
                    <span className="absolute -left-[20px] top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-indigo-500" />
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">Registered appointment in database</p>
                    <p className="text-[10px] text-zinc-400">Transaction complete</p>
                  </div>
                </div>
              </div>

              {/* Section 5: Call Reference */}
              {selectedAppt.callLogId && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <LinkIcon className="h-4 w-4 text-indigo-500" />
                    <span>Call Reference Link</span>
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono p-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg text-zinc-500">
                    <Phone className="h-4 w-4 text-zinc-400 shrink-0" />
                    <span className="truncate">{selectedAppt.callLogId}</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      )}

    </div>
  );
}
