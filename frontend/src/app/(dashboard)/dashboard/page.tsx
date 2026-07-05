"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  PhoneCall,
  CalendarCheck2,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  RefreshCw,
  Clock,
  User,
  TrendingUp,
  Activity,
  Users,
  XCircle,
  AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalCalls: number;
  activeCalls: number;
  bookedAppointments: number;
  cancelledAppointments: number;
  successRate: number;
  humanHandoffs: number;
  avgCallDuration: number;
}

interface RecentAppointment {
  id: string;
  patientName: string;
  doctorName: string;
  specialization: string;
  dateTime: string;
  status: string;
}

interface RecentCall {
  id: string;
  patientName: string;
  callStatus: string;
  actionTaken: string | null;
  callDuration: number | null;
  handedOverToHuman: boolean;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ? (process.env.NEXT_PUBLIC_API_URL.endsWith('/api') ? process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') + '/api') : "http://localhost:5000/api");

function formatDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Skeleton components ──────────────────────────────────────────────────────

function KPISkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-9 w-9 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-8 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-900 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
      </div>
      <div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  accentClass?: string;
}

function KPICard({ label, value, sub, icon: Icon, iconBg, iconColor, accentClass }: KPICardProps) {
  return (
    <div
      className={`rounded-2xl border bg-white dark:bg-zinc-950 p-5 hover:shadow-md transition-all duration-200 ${
        accentClass ? `border-l-[3px] ${accentClass}` : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-500 leading-tight">{label}</p>
        <div className={`h-9 w-9 flex items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight leading-none">
          {value}
        </p>
        <p className="mt-1.5 text-xs text-zinc-400">{sub}</p>
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<RecentAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [analyticsRes, apptsRes] = await Promise.all([
        fetch(`${BASE_URL}/analytics?period=today`),
        fetch(`${BASE_URL}/appointments?limit=5&sort=desc`),
      ]);

      if (!analyticsRes.ok) throw new Error("Failed to load analytics.");
      if (!apptsRes.ok) throw new Error("Failed to load appointments.");

      const analyticsData = await analyticsRes.json();
      const apptsData = await apptsRes.json();

      setStats({
        totalCalls: analyticsData.kpis.totalCalls,
        activeCalls: analyticsData.kpis.activeCalls,
        bookedAppointments: analyticsData.kpis.bookedAppointments,
        cancelledAppointments: analyticsData.kpis.cancelledAppointments,
        successRate: analyticsData.kpis.successRate,
        humanHandoffs: analyticsData.kpis.humanHandoffs,
        avgCallDuration: analyticsData.kpis.avgCallDuration,
      });

      setRecentCalls(Array.isArray(analyticsData.recentActivity?.calls) ? analyticsData.recentActivity.calls.slice(0, 4) : []);
      const appointmentsArray = Array.isArray(apptsData?.appointments) ? apptsData.appointments : [];
      setUpcomingAppointments(appointmentsArray.slice(0, 5));
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const kpiCards: KPICardProps[] = stats
    ? [
        {
          label: "Active Calls",
          value: stats.activeCalls.toString(),
          sub: `${stats.totalCalls} calls today`,
          icon: PhoneCall,
          iconBg: "bg-indigo-50 dark:bg-indigo-950/30",
          iconColor: "text-indigo-600 dark:text-indigo-400",
          accentClass: stats.activeCalls > 0 ? "border-l-indigo-500" : undefined,
        },
        {
          label: "Appointments Booked",
          value: stats.bookedAppointments.toLocaleString(),
          sub: `${stats.cancelledAppointments} cancelled today`,
          icon: CalendarCheck2,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          accentClass: "border-l-emerald-500",
        },
        {
          label: "AI Success Rate",
          value: `${stats.successRate}%`,
          sub: `${stats.humanHandoffs} human handoffs`,
          icon: ShieldCheck,
          iconBg: "bg-violet-50 dark:bg-violet-950/30",
          iconColor: "text-violet-600 dark:text-violet-400",
          accentClass: "border-l-violet-500",
        },
        {
          label: "Avg Call Duration",
          value: formatDuration(stats.avgCallDuration),
          sub: "Per completed call",
          icon: Zap,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
        },
      ]
    : [];

  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    CONFIRMED:   { label: "Confirmed",   cls: "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400" },
    PENDING:     { label: "Pending",     cls: "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400" },
    CANCELLED:   { label: "Cancelled",   cls: "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400" },
    RESCHEDULED: { label: "Rescheduled", cls: "bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400" },
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Dashboard Overview
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Real-time monitoring for AstraMind AI receptionist services.
            {lastUpdated && (
              <span className="ml-2 text-zinc-400">
                · Updated {formatRelativeTime(lastUpdated.toISOString())}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={isLoading}
          aria-label="Refresh dashboard metrics"
          className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors shadow-sm shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 text-sm text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
          <button
            onClick={fetchDashboard}
            className="ml-auto text-xs font-semibold hover:underline flex items-center gap-1 bg-rose-100 dark:bg-rose-900/40 px-2.5 py-1 rounded-md"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)
          : kpiCards.map((card) => <KPICard key={card.label} {...card} />)}
      </div>

      {/* ── Quick Stats Row ─────────────────────────────────────────────────── */}
      {!isLoading && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Calls Today", value: stats.totalCalls, icon: Activity, color: "text-indigo-500" },
            { label: "Human Handoffs", value: stats.humanHandoffs, icon: Users, color: "text-amber-500" },
            { label: "Cancellations", value: stats.cancelledAppointments, icon: XCircle, color: "text-rose-500" },
            { label: "Avg Duration", value: formatDuration(stats.avgCallDuration), icon: Clock, color: "text-teal-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 flex items-center gap-3"
            >
              <Icon className={`h-4 w-4 shrink-0 ${color}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 truncate">{label}</p>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Content Grid ──────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Recent Call Activity */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-900">
            <div>
              <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                Recent Call Activity
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Latest AI receptionist outcomes.</p>
            </div>
            <Link
              href="/live-calls"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
              aria-label="View all live calls"
            >
              View all
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          <div className="divide-y divide-zinc-50 dark:divide-zinc-900">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5">
                  <RowSkeleton />
                </div>
              ))
            ) : recentCalls.length > 0 ? (
              recentCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between py-3 px-5 hover:bg-zinc-50/60 dark:hover:bg-zinc-900/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                      call.handedOverToHuman
                        ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600"
                        : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600"
                    }`}>
                      <PhoneCall className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                        {call.patientName}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {call.actionTaken?.replace(/_/g, " ") ?? "No action"} · {formatRelativeTime(call.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {call.handedOverToHuman && (
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                        Transferred
                      </span>
                    )}
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 capitalize ${
                      call.callStatus === "completed"
                        ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600"
                        : call.callStatus === "in-progress"
                        ? "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 animate-pulse"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                    }`}>
                      {call.callStatus}
                    </span>
                    {call.callDuration != null && (
                      <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                        {formatDuration(call.callDuration)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                <PhoneCall className="h-8 w-8 text-zinc-300 mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-zinc-500">No calls recorded today.</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Calls will appear here as the AI receptionist handles them.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-900">
            <div>
              <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <CalendarCheck2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                Upcoming Agenda
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Upcoming appointments.</p>
            </div>
            <Link
              href="/appointments"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
              aria-label="View all appointments"
            >
              View all
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          <div className="p-4 space-y-2">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse"
                />
              ))
            ) : upcomingAppointments.length > 0 ? (
              upcomingAppointments.map((appt) => {
                const badge = STATUS_MAP[appt.status] ?? { label: appt.status, cls: "bg-zinc-100 text-zinc-500" };
                return (
                  <div
                    key={appt.id}
                    className="flex gap-3.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/40 dark:bg-zinc-900/20 hover:border-zinc-200 dark:hover:border-zinc-800 transition-all"
                  >
                    <div className="flex flex-col items-center justify-center bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-semibold text-[10px] px-2 rounded-lg border border-indigo-100 dark:border-indigo-900/30 min-w-[44px]">
                      <Clock className="h-3 w-3 mb-0.5" aria-hidden="true" />
                      <span>
                        {new Date(appt.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        {appt.patientName}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-0.5">
                        <User className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{appt.doctorName}</span>
                        {appt.specialization && (
                          <span className="text-zinc-300 dark:text-zinc-600">· {appt.specialization}</span>
                        )}
                      </div>
                    </div>
                    <span className={`self-start text-[9px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
                <CalendarCheck2 className="h-7 w-7 text-zinc-300 mb-2" aria-hidden="true" />
                <p className="text-xs text-zinc-500">No upcoming appointments.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
