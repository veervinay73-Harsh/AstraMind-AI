"use client";

import { useState, useEffect, useCallback } from "react";
import {
  User,
  Phone,
  Mail,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  PhoneCall,
  FileText,
  Activity,
  MessageSquare,
  BadgeInfo,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Type Definitions ────────────────────────────────────────────────────────

interface LastAppointment {
  id: string;
  dateTime: string;
  status: string;
  doctorName: string | null;
  specialization: string | null;
}

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  dob: string | null;
  createdAt: string;
  totalAppointments: number;
  lastAppointment: LastAppointment | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PatientStats {
  totalAppointments: number;
  totalCalls: number;
  CONFIRMED: number;
  PENDING: number;
  CANCELLED: number;
  RESCHEDULED: number;
}

interface AppointmentRecord {
  id: string;
  dateTime: string;
  status: string;
  notes: string | null;
  duration: number;
  doctorName: string | null;
  specialization: string | null;
  callLogId: string | null;
}

interface CallMessage {
  role: string;
  content: string;
  timestamp: string;
}

interface CallLogRecord {
  id: string;
  twilioCallSid: string;
  callStatus: string;
  callDuration: number | null;
  actionTaken: string | null;
  summary: string | null;
  handedOverToHuman: boolean;
  createdAt: string;
  messageCount: number;
  recentMessages: CallMessage[];
}

interface PatientProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  dob: string | null;
  createdAt: string;
  stats: PatientStats;
  appointments: AppointmentRecord[];
  callLogs: CallLogRecord[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    CONFIRMED: "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400",
    PENDING: "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400",
    CANCELLED: "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400",
    RESCHEDULED: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400",
  };
  return map[status] ?? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500";
}

function statusIcon(status: string) {
  if (status === "CONFIRMED") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "CANCELLED") return <XCircle className="h-3 w-3" />;
  if (status === "RESCHEDULED") return <RotateCcw className="h-3 w-3" />;
  return <Clock className="h-3 w-3" />;
}

// ─── Table Row Skeleton ───────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b border-zinc-100 dark:border-zinc-900">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
          </div>
        </div>
      </td>
      <td className="p-4">
        <div className="space-y-1.5">
          <div className="h-3 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-3 w-36 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
      </td>
      <td className="p-4">
        <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </td>
      <td className="p-4">
        <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </td>
      <td className="p-4">
        <div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
      </td>
      <td className="p-4 text-right">
        <div className="h-7 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-lg ml-auto" />
      </td>
    </tr>
  );
}

// ─── Appointment Timeline ─────────────────────────────────────────────────────

function AppointmentTimeline({ appointments }: { appointments: AppointmentRecord[] }) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-400">
        <Calendar className="h-8 w-8 text-zinc-300 mb-2" />
        <p className="text-xs">No appointment history found.</p>
      </div>
    );
  }

  return (
    <div className="relative border-l-2 border-zinc-100 dark:border-zinc-800 ml-3 pl-5 space-y-4">
      {appointments.map((appt) => (
        <div key={appt.id} className="relative">
          {/* Timeline dot */}
          <span
            className={`absolute -left-[26px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white dark:border-zinc-950 ${
              appt.status === "CONFIRMED"
                ? "bg-indigo-500"
                : appt.status === "CANCELLED"
                ? "bg-rose-500"
                : appt.status === "RESCHEDULED"
                ? "bg-emerald-500"
                : "bg-amber-400"
            }`}
          />

          <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 p-3.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {appt.doctorName ?? "Unknown Doctor"}
                  {appt.specialization && (
                    <span className="text-zinc-400 font-normal"> · {appt.specialization}</span>
                  )}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {formatDateTime(appt.dateTime)}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusBadge(appt.status)}`}
              >
                {statusIcon(appt.status)}
                {appt.status.toLowerCase()}
              </span>
            </div>
            {appt.notes && (
              <p className="text-[11px] text-zinc-500 italic border-t border-zinc-100 dark:border-zinc-800 pt-1.5">
                {appt.notes}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Call History ─────────────────────────────────────────────────────────────

function CallHistory({ callLogs }: { callLogs: CallLogRecord[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (callLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-400">
        <PhoneCall className="h-8 w-8 text-zinc-300 mb-2" />
        <p className="text-xs">No call history found for this patient.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {callLogs.map((log) => {
        const isExpanded = expandedId === log.id;
        return (
          <div
            key={log.id}
            className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 overflow-hidden"
          >
            {/* Call Header (always visible) */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : log.id)}
              className="w-full flex items-center justify-between p-3.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                    log.callStatus === "completed"
                      ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600"
                      : log.callStatus === "failed"
                      ? "bg-rose-100 dark:bg-rose-950/30 text-rose-600"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    {log.actionTaken
                      ? log.actionTaken.replace(/_/g, " ")
                      : "No action recorded"}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {formatDate(log.createdAt)} · {formatDuration(log.callDuration)}
                    {log.handedOverToHuman && (
                      <span className="ml-1.5 text-amber-500 font-semibold">· Transferred</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-[10px] font-bold rounded-full px-2 py-0.5 capitalize ${
                    log.callStatus === "completed"
                      ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600"
                      : log.callStatus === "failed"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {log.callStatus}
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                )}
              </div>
            </button>

            {/* Expanded Detail */}
            {isExpanded && (
              <div className="border-t border-zinc-100 dark:border-zinc-800 p-3.5 space-y-3">
                {/* AI Summary */}
                {log.summary ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      AI Summary
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed italic">
                      "{log.summary}"
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No AI summary available.</p>
                )}

                {/* Recent Transcript */}
                {log.recentMessages.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      Conversation Excerpt
                    </p>
                    <div className="space-y-1">
                      {log.recentMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-2 text-[11px] ${
                            msg.role === "USER" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-xl px-3 py-1.5 leading-snug ${
                              msg.role === "USER"
                                ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                                : msg.role === "ASSISTANT"
                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                : "bg-transparent text-zinc-400 italic text-center"
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Call SID reference */}
                <p className="text-[9px] text-zinc-400 font-mono truncate">
                  SID: {log.twilioCallSid}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Patient Details Drawer ───────────────────────────────────────────────────

function PatientDrawer({
  patient,
  onClose,
}: {
  patient: Patient;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"appointments" | "calls">("appointments");

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const baseUrl = (process.env.NEXT_PUBLIC_API_URL ? (process.env.NEXT_PUBLIC_API_URL.endsWith('/api') ? process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') + '/api') : "http://localhost:5000/api");
        const res = await fetch(`${baseUrl}/patients/${patient.id}`);
        if (!res.ok) throw new Error("Failed to load patient profile.");
        const data: PatientProfile = await res.json();
        setProfile(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [patient.id]);

  const initials = patient.name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {initials}
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">{patient.name}</h2>
              <p className="text-xs text-zinc-500">{patient.phone}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-100 dark:border-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">

          {/* Loading State */}
          {isLoading && (
            <div className="p-6 space-y-4 animate-pulse">
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                ))}
              </div>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
                ))}
              </div>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="p-6">
              <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 text-sm text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Profile Content */}
          {!isLoading && profile && (
            <div className="p-6 space-y-5 text-sm">

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Total Appts", value: profile.stats.totalAppointments, color: "text-zinc-900 dark:text-white" },
                  { label: "Confirmed", value: profile.stats.CONFIRMED, color: "text-indigo-600 dark:text-indigo-400" },
                  { label: "Cancelled", value: profile.stats.CANCELLED, color: "text-rose-600 dark:text-rose-400" },
                  { label: "AI Calls", value: profile.stats.totalCalls, color: "text-violet-600 dark:text-violet-400" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 p-3 text-center"
                  >
                    <p className={`text-lg font-bold leading-none mb-1 ${stat.color}`}>
                      {stat.value}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-medium">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Personal Information */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <BadgeInfo className="h-3.5 w-3.5 text-indigo-500" />
                  Personal Information
                </h3>
                <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 p-4 space-y-2.5">
                  {[
                    { label: "Full Name", value: profile.name, icon: <User className="h-3.5 w-3.5 text-zinc-400" /> },
                    { label: "Phone", value: profile.phone, icon: <Phone className="h-3.5 w-3.5 text-zinc-400" /> },
                    { label: "Email", value: profile.email ?? "Not provided", icon: <Mail className="h-3.5 w-3.5 text-zinc-400" /> },
                    {
                      label: "Date of Birth",
                      value: profile.dob ? formatDate(profile.dob) : "Not recorded",
                      icon: <Calendar className="h-3.5 w-3.5 text-zinc-400" />,
                    },
                    {
                      label: "Patient Since",
                      value: formatDate(profile.createdAt),
                      icon: <Clock className="h-3.5 w-3.5 text-zinc-400" />,
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-zinc-500 shrink-0">
                        {row.icon}
                        {row.label}
                      </span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 text-right truncate max-w-[220px]">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs: Appointments | Calls */}
              <div className="space-y-3">
                <div className="flex rounded-xl border border-zinc-100 dark:border-zinc-900 overflow-hidden p-1 gap-1 bg-zinc-50/50 dark:bg-zinc-900/20">
                  <button
                    onClick={() => setActiveTab("appointments")}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                      activeTab === "appointments"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Appointments ({profile.stats.totalAppointments})
                  </button>
                  <button
                    onClick={() => setActiveTab("calls")}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                      activeTab === "calls"
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Call Logs ({profile.stats.totalCalls})
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === "appointments" ? (
                  <AppointmentTimeline appointments={profile.appointments} />
                ) : (
                  <CallHistory callLogs={profile.callLogs} />
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Patients Page ───────────────────────────────────────────────────────

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search / sort / pagination state
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  // Drawer state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL ? (process.env.NEXT_PUBLIC_API_URL.endsWith('/api') ? process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') + '/api') : "http://localhost:5000/api");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort,
        ...(search && { search }),
      });
      const res = await fetch(`${baseUrl}/patients?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load patients from server.");
      const data = await res.json();
      setPatients(data.patients);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [search, sort, page, limit]);

  useEffect(() => {
    fetchPatients();
    const handleRefresh = () => {
      fetchPatients();
    };
    window.addEventListener("refresh_dashboard", handleRefresh);
    return () => window.removeEventListener("refresh_dashboard", handleRefresh);
  }, [fetchPatients]);

  const handleResetFilters = () => {
    setSearch("");
    setSort("name");
    setPage(1);
  };

  return (
    <div className="space-y-6 relative min-h-screen pb-16">

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Patients Registry
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Search patient records, view appointment histories, and review AI call logs.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 text-sm text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchPatients}
            className="flex items-center gap-1 text-xs font-semibold hover:underline bg-rose-100 dark:bg-rose-900/40 px-2.5 py-1 rounded-md"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Search + Filter Controls */}
      <div className="space-y-3 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, phone, or email..."
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm placeholder-zinc-400 focus:outline-none focus:border-indigo-500 dark:text-zinc-200"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-3">
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="name">Sort: Name (A–Z)</option>
              <option value="recent">Sort: Recent Activity</option>
            </select>

            <button
              onClick={handleResetFilters}
              className="h-9 px-4 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors shrink-0"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Record Count */}
      {!isLoading && !error && (
        <p className="text-xs text-zinc-400">
          Showing{" "}
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{patients.length}</span>{" "}
          of{" "}
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pagination.total}</span>{" "}
          patients
        </p>
      )}

      {/* Patients Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
        {patients.length === 0 && !isLoading && !error ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400">
            <User className="h-10 w-10 text-zinc-300 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No Patients Found</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              Try clearing your search query or adjusting your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/10 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="p-4">Patient</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Date of Birth</th>
                  <th className="p-4">Last Appointment</th>
                  <th className="p-4">Appts</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-sm">
                {isLoading
                  ? Array.from({ length: limit }).map((_, i) => <RowSkeleton key={i} />)
                  : patients.map((pat) => {
                      const initials = pat.name
                        .split(" ")
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join("")
                        .toUpperCase();

                      return (
                        <tr
                          key={pat.id}
                          onClick={() => setSelectedPatient(pat)}
                          className="hover:bg-zinc-50/40 dark:hover:bg-zinc-900/10 transition-colors cursor-pointer group"
                        >
                          {/* Patient Name + Avatar */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {pat.name}
                                </p>
                                <p className="text-[11px] text-zinc-400 font-mono">
                                  ID: {pat.id.slice(0, 8)}…
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Contact */}
                          <td className="p-4">
                            <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                              <div className="flex items-center gap-1.5">
                                <Phone className="h-3 w-3 text-zinc-400 shrink-0" />
                                <span>{pat.phone}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Mail className="h-3 w-3 text-zinc-400 shrink-0" />
                                <span className="truncate max-w-[160px]">{pat.email ?? "—"}</span>
                              </div>
                            </div>
                          </td>

                          {/* Date of Birth */}
                          <td className="p-4 text-sm text-zinc-700 dark:text-zinc-300">
                            {pat.dob ? (
                              <span className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                                {formatDate(pat.dob)}
                              </span>
                            ) : (
                              <span className="text-zinc-400 text-xs italic">Not recorded</span>
                            )}
                          </td>

                          {/* Last Appointment */}
                          <td className="p-4">
                            {pat.lastAppointment ? (
                              <div className="space-y-0.5">
                                <p className="text-xs text-zinc-700 dark:text-zinc-300">
                                  {formatDate(pat.lastAppointment.dateTime)}
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize ${statusBadge(pat.lastAppointment.status)}`}
                                  >
                                    {statusIcon(pat.lastAppointment.status)}
                                    {pat.lastAppointment.status.toLowerCase()}
                                  </span>
                                </div>
                                {pat.lastAppointment.doctorName && (
                                  <p className="text-[10px] text-zinc-400">
                                    {pat.lastAppointment.doctorName}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-400 italic">No appointments</span>
                            )}
                          </td>

                          {/* Total Appointments Badge */}
                          <td className="p-4">
                            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                              {pat.totalAppointments}
                            </span>
                          </td>

                          {/* View Button */}
                          <td className="p-4 text-right">
                            <button className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
                              <FileText className="h-3 w-3" />
                              View
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
        {!isLoading && pagination.total > 0 && (
          <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-900 px-6 py-4">
            <span className="text-xs text-zinc-500">
              Page{" "}
              <strong className="text-zinc-800 dark:text-zinc-200">{pagination.page}</strong> of{" "}
              <strong className="text-zinc-800 dark:text-zinc-200">{pagination.totalPages}</strong>{" "}
              ({pagination.total} patients)
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
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Patient Details Drawer */}
      {selectedPatient && (
        <PatientDrawer
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </div>
  );
}
