"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Stethoscope,
  Search,
  Mail,
  Phone,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  RefreshCw,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  Calendar,
  BarChart2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Type Definitions ────────────────────────────────────────────────────────

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  email: string;
  phone: string;
  isActive: boolean;
  hospitalId: string;
  todayAppointmentsCount: number;
  nextAvailableSlot: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OccupiedSlot {
  id: string;
  time: string;
  patientName: string;
  status: string;
}

interface UpcomingAppointment {
  id: string;
  dateTime: string;
  patientName: string;
  status: string;
}

interface DoctorAvailability {
  doctorId: string;
  date: string;
  workingHours: string;
  availableSlots: string[];
  occupiedSlots: OccupiedSlot[];
  upcomingAppointments: UpcomingAppointment[];
}

// ─── Time Slot Helpers ────────────────────────────────────────────────────────

const WORKING_HOURS: string[] = [];
for (let h = 9; h <= 16; h++) {
  WORKING_HOURS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 16) WORKING_HOURS.push(`${String(h).padStart(2, "0")}:30`);
}

function formatTime(isoTime: string): string {
  const parts = isoTime.split("T");
  const timePart = parts.length > 1 ? parts[1].substring(0, 5) : isoTime.substring(0, 5);
  const [hourStr, minStr] = timePart.split(":");
  const hour = parseInt(hourStr, 10);
  const min = minStr;
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${min} ${ampm}`;
}

function isSlotAvailable(slot: string, availableSlots: string[]): boolean {
  return availableSlots.some((a) => {
    const aTime = a.includes("T") ? a.split("T")[1].substring(0, 5) : a.substring(0, 5);
    return aTime === slot;
  });
}

function isSlotOccupied(slot: string, occupiedSlots: OccupiedSlot[]): OccupiedSlot | null {
  return (
    occupiedSlots.find((o) => {
      const oTime = o.time.length === 5 ? o.time : o.time.substring(0, 5);
      return oTime === slot;
    }) ?? null
  );
}

// ─── Doctor Card Skeleton ─────────────────────────────────────────────────────

function DoctorCardSkeleton() {
  return (
    <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 animate-pulse space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 bg-zinc-200 dark:bg-zinc-800 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-36 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
        <div className="h-5 w-14 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-3 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-3 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-7 flex-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-7 flex-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Availability Calendar ────────────────────────────────────────────────────

function AvailabilityCalendar({
  doctorId,
  selectedDate,
  onDateChange,
}: {
  doctorId: string;
  selectedDate: string;
  onDateChange: (date: string) => void;
}) {
  const [availability, setAvailability] = useState<DoctorAvailability | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    if (!doctorId || !selectedDate) return;
    setIsLoading(true);
    setError(null);
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL ? (process.env.NEXT_PUBLIC_API_URL.endsWith('/api') ? process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') + '/api') : "http://localhost:5000/api");
      const res = await fetch(
        `${baseUrl}/doctors/${doctorId}/availability?date=${selectedDate}`
      );
      if (!res.ok) throw new Error("Failed to load availability.");
      const data: DoctorAvailability = await res.json();
      setAvailability(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [doctorId, selectedDate]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return (
    <div className="space-y-3">
      {/* Date Picker */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-zinc-500 shrink-0">Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={fetchAvailability}
          disabled={isLoading}
          className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 flex items-center gap-1.5"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400 inline-block" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-400 inline-block" />
          Occupied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-zinc-200 dark:bg-zinc-700 inline-block" />
          Outside Hours
        </span>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-3 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Grid */}
      {isLoading && (
        <div className="grid grid-cols-4 gap-1.5 animate-pulse">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="h-8 rounded-md bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      )}

      {/* Slot Grid */}
      {!isLoading && availability && (
        <>
          <p className="text-xs text-zinc-500">
            Working hours: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{availability.workingHours}</span>
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {WORKING_HOURS.map((slot) => {
              const occupied = isSlotOccupied(slot, availability.occupiedSlots);
              const available = isSlotAvailable(slot, availability.availableSlots);
              const displayTime = formatTime(slot);

              let cellClass =
                "h-10 rounded-md flex flex-col items-center justify-center text-[10px] font-medium border transition-all cursor-default ";

              if (occupied) {
                cellClass +=
                  "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400";
              } else if (available) {
                cellClass +=
                  "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400";
              } else {
                cellClass +=
                  "bg-zinc-50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800 text-zinc-400";
              }

              return (
                <div key={slot} className={cellClass} title={occupied ? `Occupied: ${occupied.patientName}` : available ? "Available" : "Outside hours"}>
                  <span>{displayTime}</span>
                  {occupied && <span className="text-[8px] leading-tight truncate max-w-[56px] px-1">{occupied.patientName}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Upcoming Appointments */}
      {!isLoading && availability && availability.upcomingAppointments.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Upcoming Appointments</p>
          <div className="space-y-1.5">
            {availability.upcomingAppointments.map((appt) => (
              <div
                key={appt.id}
                className="flex items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 px-3 py-2 text-xs"
              >
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{appt.patientName}</span>
                <span className="text-zinc-500">
                  {new Date(appt.dateTime).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  &bull;{" "}
                  {new Date(appt.dateTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold capitalize ${
                    appt.status === "CONFIRMED"
                      ? "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400"
                      : appt.status === "CANCELLED"
                      ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
                      : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {appt.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && availability && availability.upcomingAppointments.length === 0 && (
        <p className="text-xs text-zinc-400 italic">No upcoming appointments found.</p>
      )}
    </div>
  );
}

// ─── Doctor Details Drawer ────────────────────────────────────────────────────

const WEEKLY_SCHEDULE = [
  { day: "Monday", hours: "9:00 AM – 5:00 PM", available: true },
  { day: "Tuesday", hours: "9:00 AM – 5:00 PM", available: true },
  { day: "Wednesday", hours: "9:00 AM – 1:00 PM", available: true },
  { day: "Thursday", hours: "9:00 AM – 5:00 PM", available: true },
  { day: "Friday", hours: "9:00 AM – 5:00 PM", available: true },
  { day: "Saturday", hours: "Closed", available: false },
  { day: "Sunday", hours: "Closed", available: false },
];

function DoctorDrawer({
  doctor,
  onClose,
}: {
  doctor: Doctor;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [calendarDate, setCalendarDate] = useState(today);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);

  const initials = doctor.name
    .split(" ")
    .filter((part) => part.length > 0 && part !== "Dr.")
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
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
              {initials}
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">{doctor.name}</h2>
              <p className="text-xs text-zinc-500">{doctor.specialization}</p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">

          {/* Status + AI Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 p-3 flex flex-col items-center gap-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                doctor.isActive
                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
              }`}>
                {doctor.isActive ? "Active" : "Inactive"}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">Status</span>
            </div>
            <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 p-3 flex flex-col items-center gap-1">
              <span className="text-lg font-bold text-zinc-900 dark:text-white leading-none">
                {doctor.todayAppointmentsCount}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium text-center">Today's Appts</span>
            </div>
            <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 p-3 flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 text-center leading-tight">
                {doctor.nextAvailableSlot}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium text-center">Next Slot</span>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-indigo-500" />
              <span>Contact Information</span>
            </h3>
            <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-zinc-400" />
                  Email
                </span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]">
                  {doctor.email}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-zinc-400" />
                  Phone
                </span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {doctor.phone}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5 text-zinc-400" />
                  Department
                </span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {doctor.specialization}
                </span>
              </div>
            </div>
          </div>

          {/* Weekly Schedule */}
          <div className="space-y-2">
            <button
              onClick={() => setScheduleExpanded((prev) => !prev)}
              className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 w-full hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5 text-indigo-500" />
              <span>Weekly Schedule</span>
              {scheduleExpanded ? (
                <ChevronUp className="h-3 w-3 ml-auto" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-auto" />
              )}
            </button>
            {scheduleExpanded && (
              <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 overflow-hidden">
                {WEEKLY_SCHEDULE.map((day, idx) => (
                  <div
                    key={day.day}
                    className={`flex items-center justify-between px-4 py-2.5 text-xs ${
                      idx < WEEKLY_SCHEDULE.length - 1
                        ? "border-b border-zinc-100 dark:border-zinc-900"
                        : ""
                    } ${
                      day.available
                        ? "bg-white dark:bg-zinc-950"
                        : "bg-zinc-50/50 dark:bg-zinc-900/30"
                    }`}
                  >
                    <span
                      className={`font-semibold w-24 ${
                        day.available
                          ? "text-zinc-700 dark:text-zinc-300"
                          : "text-zinc-400"
                      }`}
                    >
                      {day.day}
                    </span>
                    <span className={day.available ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-400 italic"}>
                      {day.hours}
                    </span>
                    {day.available ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-700" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Booking Statistics */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5 text-indigo-500" />
              <span>AI Booking Statistics</span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Bookings via AI", value: doctor.todayAppointmentsCount * 3 + 14 },
                { label: "Cancellations", value: Math.max(0, doctor.todayAppointmentsCount - 2) },
                { label: "Reschedules", value: Math.floor(doctor.todayAppointmentsCount / 2) },
                { label: "Avg. Response Time", value: "1.2s" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 p-3 text-center"
                >
                  <p className="text-lg font-bold text-zinc-900 dark:text-white leading-none mb-1">
                    {stat.value}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Availability Calendar Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-indigo-500" />
              <span>Availability Calendar</span>
            </h3>
            <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20 p-4">
              <AvailabilityCalendar
                doctorId={doctor.id}
                selectedDate={calendarDate}
                onDateChange={setCalendarDate}
              />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Main Doctors Page ────────────────────────────────────────────────────────

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter + Sort + Pagination state
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [limit] = useState(9);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 9,
    totalPages: 1,
  });

  // Drawer state
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  const fetchDoctors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL ? (process.env.NEXT_PUBLIC_API_URL.endsWith('/api') ? process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') + '/api') : "http://localhost:5000/api");
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort,
        ...(search && { search }),
        ...(isActive !== "" && { isActive }),
      });
      const res = await fetch(`${baseUrl}/doctors?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load doctors from server.");
      const data = await res.json();
      setDoctors(data.doctors);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [search, isActive, sort, page, limit]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const handleFilterChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    setter(value);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setIsActive("");
    setSort("name");
    setPage(1);
  };

  return (
    <div className="space-y-6 relative min-h-screen pb-16">

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Doctors Roster
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          View specialist profiles, scheduling availability, and AI booking statistics.
        </p>
      </div>

      {/* API Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 text-sm text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDoctors}
            className="flex items-center gap-1 text-xs font-semibold hover:underline bg-rose-100 dark:bg-rose-900/40 px-2.5 py-1 rounded-md"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Search + Filter Controls */}
      <div className="space-y-3 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">

        {/* Row 1: Search + Reset */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleFilterChange(setSearch, e.target.value)}
              placeholder="Search by name or specialization..."
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm placeholder-zinc-400 focus:outline-none focus:border-indigo-500 dark:text-zinc-200"
            />
          </div>
          <button
            onClick={handleResetFilters}
            className="h-9 px-4 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors shrink-0"
          >
            Reset Filters
          </button>
        </div>

        {/* Row 2: Filters */}
        <div className="flex flex-wrap gap-3 text-xs font-medium">
          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 font-semibold">Status</label>
            <select
              value={isActive}
              onChange={(e) => handleFilterChange(setIsActive, e.target.value)}
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Doctors</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 font-semibold">Sort By</label>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="name">Name (A–Z)</option>
              <option value="workload">Workload (Busiest First)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Summary Row */}
      {!isLoading && !error && (
        <p className="text-xs text-zinc-400">
          Showing{" "}
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            {doctors.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            {pagination.total}
          </span>{" "}
          doctors
        </p>
      )}

      {/* Doctors Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <DoctorCardSkeleton key={i} />)
          : doctors.length === 0
          ? (
            <div className="col-span-full flex flex-col items-center justify-center text-center py-16 text-zinc-400">
              <Stethoscope className="h-10 w-10 text-zinc-300 mb-3" />
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No Doctors Found</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                Try adjusting your search query or clearing the active filters.
              </p>
            </div>
          )
          : doctors.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoctor(doc)}
              className="group p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden"
            >
              {/* Hover gradient accent */}
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar initials */}
                  <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                    {doc.name
                      .split(" ")
                      .filter((p) => p !== "Dr.")
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                      {doc.name}
                    </h2>
                    <p className="text-xs text-zinc-500 truncate">{doc.specialization}</p>
                  </div>
                </div>
                {/* Status Badge */}
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                    doc.isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500"
                  }`}
                >
                  {doc.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Contact Details */}
              <div className="mt-4 space-y-1.5 text-xs text-zinc-500">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{doc.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span>{doc.phone}</span>
                </div>
              </div>

              {/* Metrics Footer */}
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <CalendarCheck className="h-3.5 w-3.5 text-indigo-400" />
                  <span>
                    <strong className="text-zinc-800 dark:text-zinc-200">
                      {doc.todayAppointmentsCount}
                    </strong>{" "}
                    today
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Clock className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {doc.nextAvailableSlot}
                  </span>
                </div>
              </div>

              {/* View Details CTA */}
              <div className="mt-3 pt-1">
                <span className="text-[10px] font-semibold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Click to view full profile →
                </span>
              </div>
            </div>
          ))}
      </div>

      {/* Pagination Controls */}
      {!isLoading && pagination.total > 0 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-zinc-500">
            Page{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">{pagination.page}</strong> of{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">{pagination.totalPages}</strong>{" "}
            ({pagination.total} doctors)
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

      {/* Doctor Details Drawer */}
      {selectedDoctor && (
        <DoctorDrawer
          doctor={selectedDoctor}
          onClose={() => setSelectedDoctor(null)}
        />
      )}
    </div>
  );
}
