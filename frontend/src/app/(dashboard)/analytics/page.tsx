"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PhoneCall,
  CalendarCheck2,
  XCircle,
  RotateCcw,
  Users,
  Clock,
  ShieldCheck,
  Zap,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Activity,
  BarChart3,
  PieChart,
  CheckCircle2,
  Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIs {
  totalCalls: number;
  activeCalls: number;
  bookedAppointments: number;
  cancelledAppointments: number;
  rescheduledAppointments: number;
  totalAppointments: number;
  humanHandoffs: number;
  avgCallDuration: number;
  successRate: number;
  completedCalls: number;
}

interface DayPoint { date: string; calls: number; handoffs: number; }
interface HourPoint { hour: number; count: number; }
interface StatusPoint { status: string; count: number; }
interface DoctorPoint { doctorId: string; doctorName: string; specialization: string; count: number; }
interface IntentPoint { intent: string; count: number; }

interface Charts {
  callsPerDay: DayPoint[];
  callsByHour: HourPoint[];
  appointmentDistribution: StatusPoint[];
  doctorWorkload: DoctorPoint[];
  intentDistribution: IntentPoint[];
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

interface RecentAppointment {
  id: string;
  patientName: string;
  doctorName: string;
  specialization: string;
  dateTime: string;
  status: string;
  createdAt: string;
}

interface AnalyticsData {
  period: { label: string; from: string; to: string };
  kpis: KPIs;
  charts: Charts;
  recentActivity: { calls: RecentCall[]; appointments: RecentAppointment[] };
}

type Period = "today" | "7d" | "30d" | "custom";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ? (process.env.NEXT_PUBLIC_API_URL.endsWith('/api') ? process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') + '/api') : "http://localhost:5000/api");

function formatDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED:   "#6366f1",
  PENDING:     "#f59e0b",
  CANCELLED:   "#f43f5e",
  RESCHEDULED: "#10b981",
};

const INTENT_COLORS = [
  "#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#ec4899",
];

// ─── KPI Card Skeleton ────────────────────────────────────────────────────────

function KPISkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 animate-pulse space-y-3">
      <div className="flex justify-between items-center">
        <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
      </div>
      <div className="h-8 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
      <div className="h-2 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
    </div>
  );
}

function ChartSkeleton({ height = "h-48" }: { height?: string }) {
  return (
    <div className={`${height} rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse`} />
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  accent?: string;
}

function KPICard({ label, value, sub, icon: Icon, iconBg, iconColor, accent }: KPICardProps) {
  return (
    <div className={`rounded-2xl border bg-white dark:bg-zinc-950 p-5 space-y-3 relative overflow-hidden ${accent ? `border-l-[3px] ${accent}` : "border-zinc-200 dark:border-zinc-800"}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-500 leading-tight">{label}</p>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight leading-none">
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-zinc-400">{sub}</p>
      )}
    </div>
  );
}

// ─── Bar Chart (CSS) ──────────────────────────────────────────────────────────

function BarChart({
  data,
  labelKey,
  valueKey,
  color = "#6366f1",
  secondValueKey,
  secondColor = "#f43f5e",
}: {
  data: Record<string, number | string>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  secondValueKey?: string;
  secondColor?: string;
}) {
  const maxVal = Math.max(...data.map((d) => Number(d[valueKey])), 1);

  return (
    <div className="flex items-end gap-1 h-40 w-full">
      {data.map((d, i) => {
        const pct = (Number(d[valueKey]) / maxVal) * 100;
        const pct2 = secondValueKey ? (Number(d[secondValueKey]) / maxVal) * 100 : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10">
              <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-semibold px-2 py-1 rounded shadow-lg whitespace-nowrap">
                {String(d[labelKey])}
                <br />
                <span style={{ color }}>{valueKey}: {String(d[valueKey])}</span>
                {secondValueKey && <><br /><span style={{ color: secondColor }}>{secondValueKey}: {String(d[secondValueKey])}</span></>}
              </div>
              <div className="w-1.5 h-1.5 bg-zinc-900 dark:bg-zinc-100 rotate-45 -mt-0.5" />
            </div>

            {/* Bars */}
            <div className="flex items-end gap-0.5 w-full h-36">
              <div
                className="flex-1 rounded-t transition-all duration-500"
                style={{ height: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
              />
              {secondValueKey && (
                <div
                  className="flex-1 rounded-t transition-all duration-500"
                  style={{ height: `${pct2}%`, backgroundColor: secondColor, opacity: 0.7 }}
                />
              )}
            </div>

            {/* Label */}
            <span className="text-[9px] text-zinc-400 font-medium truncate max-w-full text-center">
              {String(d[labelKey]).length > 5 ? String(d[labelKey]).slice(-5) : String(d[labelKey])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────

function HorizontalBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
          {label}
        </p>
        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 ml-2">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Donut Chart (SVG) ────────────────────────────────────────────────────────

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-zinc-400">No data</div>
    );
  }

  const radius = 56;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * radius;

  const slices = data.reduce((acc, d) => {
    const fraction = d.value / total;
    const dash = fraction * circumference;
    const currentOffset = acc.offset;
    acc.result.push({ ...d, dash, offset: currentOffset });
    acc.offset += dash;
    return acc;
  }, { result: [] as Array<{ label: string; value: number; color: string; dash: number; offset: number }>, offset: 0 }).result;

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg width={160} height={160} className="shrink-0">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f4f4f5" strokeWidth={20} className="dark:stroke-zinc-800" />
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={20}
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={-s.offset + circumference / 4}
            className="transition-all duration-700"
          />
        ))}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-zinc-900 dark:fill-white" fontSize={22} fontWeight={700}>
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="middle" fill="#a1a1aa" fontSize={9}>
          Total
        </text>
      </svg>
      <div className="space-y-2">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-zinc-600 dark:text-zinc-400 capitalize">
              {s.label.toLowerCase()}
            </span>
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 ml-auto pl-4">
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Period Selector ──────────────────────────────────────────────────────────

function PeriodSelector({
  period,
  customFrom,
  customTo,
  onChange,
  onCustomChange,
}: {
  period: Period;
  customFrom: string;
  customTo: string;
  onChange: (p: Period) => void;
  onCustomChange: (from: string, to: string) => void;
}) {
  const tabs: { label: string; value: Period }[] = [
    { label: "Today", value: "today" },
    { label: "7 Days", value: "7d" },
    { label: "30 Days", value: "30d" },
    { label: "Custom", value: "custom" },
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 p-1 gap-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              period === t.value
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="flex items-center gap-2 text-xs">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomChange(e.target.value, customTo)}
            className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500 text-xs"
          />
          <span className="text-zinc-400">→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomChange(customFrom, e.target.value)}
            className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500 text-xs"
          />
        </div>
      )}
    </div>
  );
}

// ─── Chart Card wrapper ───────────────────────────────────────────────────────

function ChartCard({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4 ${className}`}>
      <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">
        <Icon className="h-4 w-4 text-indigo-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Main Analytics Page ──────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<Period>("7d");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      if (period === "custom" && customFrom && customTo) {
        params.set("from", customFrom);
        params.set("to", customTo);
      }
      const res = await fetch(`${BASE_URL}/analytics?${params}`);
      if (!res.ok) throw new Error("Failed to load analytics data.");
      const json: AnalyticsData = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => {
    fetchAnalytics();
    const handleRefresh = () => fetchAnalytics();
    window.addEventListener("refresh_dashboard", handleRefresh);
    return () => window.removeEventListener("refresh_dashboard", handleRefresh);
  }, [fetchAnalytics]);

  // ── KPI Card definitions ──────────────────────────────────────────────────
  const kpiCards: KPICardProps[] = data
    ? [
        {
          label: "Total Calls",
          value: data.kpis.totalCalls.toLocaleString(),
          sub: `${data.kpis.completedCalls} completed`,
          icon: PhoneCall,
          iconBg: "bg-indigo-50 dark:bg-indigo-950/30",
          iconColor: "text-indigo-600 dark:text-indigo-400",
          accent: "border-l-indigo-500",
        },
        {
          label: "Active Calls",
          value: data.kpis.activeCalls.toString(),
          sub: "Currently in progress",
          icon: Zap,
          iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          accent: data.kpis.activeCalls > 0 ? "border-l-emerald-500" : undefined,
        },
        {
          label: "Booked Appointments",
          value: data.kpis.bookedAppointments.toLocaleString(),
          sub: `of ${data.kpis.totalAppointments} total`,
          icon: CalendarCheck2,
          iconBg: "bg-sky-50 dark:bg-sky-950/30",
          iconColor: "text-sky-600 dark:text-sky-400",
          accent: "border-l-sky-500",
        },
        {
          label: "Cancellations",
          value: data.kpis.cancelledAppointments.toLocaleString(),
          sub: `${data.kpis.rescheduledAppointments} rescheduled`,
          icon: XCircle,
          iconBg: "bg-rose-50 dark:bg-rose-950/30",
          iconColor: "text-rose-600 dark:text-rose-400",
        },
        {
          label: "Human Handoffs",
          value: data.kpis.humanHandoffs.toLocaleString(),
          sub: `${data.kpis.totalCalls > 0 ? ((data.kpis.humanHandoffs / data.kpis.totalCalls) * 100).toFixed(1) : 0}% of calls`,
          icon: Users,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
        },
        {
          label: "Avg Call Duration",
          value: formatDuration(data.kpis.avgCallDuration),
          sub: "Per completed call",
          icon: Clock,
          iconBg: "bg-violet-50 dark:bg-violet-950/30",
          iconColor: "text-violet-600 dark:text-violet-400",
        },
        {
          label: "AI Success Rate",
          value: `${data.kpis.successRate}%`,
          sub: "Resolved without handoff",
          icon: ShieldCheck,
          iconBg: "bg-teal-50 dark:bg-teal-950/30",
          iconColor: "text-teal-600 dark:text-teal-400",
          accent: "border-l-teal-500",
        },
        {
          label: "Rescheduled",
          value: data.kpis.rescheduledAppointments.toLocaleString(),
          sub: "Appointment changes",
          icon: RotateCcw,
          iconBg: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
          iconColor: "text-fuchsia-600 dark:text-fuchsia-400",
        },
      ]
    : [];

  return (
    <div className="space-y-6 pb-16">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Analytics Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Real-time AI receptionist performance and hospital activity metrics.
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={isLoading}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Period Selector */}
      <PeriodSelector
        period={period}
        customFrom={customFrom}
        customTo={customTo}
        onChange={(p) => { setPeriod(p); }}
        onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
      />

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 text-sm text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-1 text-xs font-semibold hover:underline bg-rose-100 dark:bg-rose-900/40 px-2.5 py-1 rounded-md"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <KPISkeleton key={i} />)
          : kpiCards.map((card) => <KPICard key={card.label} {...card} />)}
      </div>

      {/* ── Charts Row 1: Calls Per Day + Calls By Hour ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Calls Per Day */}
        <ChartCard title="Calls Per Day" icon={TrendingUp}>
          {isLoading ? (
            <ChartSkeleton />
          ) : data && data.charts.callsPerDay.length > 0 ? (
            <>
              <BarChart
                data={data.charts.callsPerDay as unknown as Record<string, string | number>[]}
                labelKey="date"
                valueKey="calls"
                color="#6366f1"
                secondValueKey="handoffs"
                secondColor="#f43f5e"
              />
              <div className="flex items-center gap-4 text-[10px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block" /> Calls
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" /> Handoffs
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-400">
              <BarChart3 className="h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-xs">No call data for this period.</p>
            </div>
          )}
        </ChartCard>

        {/* Calls By Hour */}
        <ChartCard title="Call Volume by Hour" icon={Activity}>
          {isLoading ? (
            <ChartSkeleton />
          ) : data ? (
            <BarChart
              data={data.charts.callsByHour.map((d) => ({
                hour: `${d.hour.toString().padStart(2, "0")}h`,
                count: d.count,
              }))}
              labelKey="hour"
              valueKey="count"
              color="#8b5cf6"
            />
          ) : null}
        </ChartCard>
      </div>

      {/* ── Charts Row 2: Appointment Distribution + Doctor Workload ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Appointment Status Donut */}
        <ChartCard title="Appointment Status Distribution" icon={PieChart}>
          {isLoading ? (
            <ChartSkeleton height="h-36" />
          ) : data ? (
            data.charts.appointmentDistribution.length > 0 ? (
              <DonutChart
                data={data.charts.appointmentDistribution.map((d) => ({
                  label: d.status,
                  value: d.count,
                  color: STATUS_COLORS[d.status] ?? "#a1a1aa",
                }))}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-zinc-400">
                <PieChart className="h-8 w-8 text-zinc-300 mb-2" />
                <p className="text-xs">No appointments for this period.</p>
              </div>
            )
          ) : null}
        </ChartCard>

        {/* Doctor Workload */}
        <ChartCard title="Doctor Workload" icon={Users}>
          {isLoading ? (
            <ChartSkeleton height="h-48" />
          ) : data ? (
            data.charts.doctorWorkload.length > 0 ? (
              <div className="space-y-3">
                {data.charts.doctorWorkload.map((d, i) => (
                  <HorizontalBar
                    key={d.doctorId}
                    label={`${d.doctorName} · ${d.specialization}`}
                    value={d.count}
                    max={data.charts.doctorWorkload[0].count}
                    color={INTENT_COLORS[i % INTENT_COLORS.length]}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-zinc-400">
                <Users className="h-8 w-8 text-zinc-300 mb-2" />
                <p className="text-xs">No appointment data for this period.</p>
              </div>
            )
          ) : null}
        </ChartCard>
      </div>

      {/* ── Charts Row 3: AI Intent Distribution ─────────────────────────── */}
      <ChartCard title="AI Intent Distribution" icon={BarChart3}>
        {isLoading ? (
          <ChartSkeleton height="h-32" />
        ) : data ? (
          data.charts.intentDistribution.length > 0 ? (
            <div className="flex items-end gap-1 h-32 w-full">
              {(() => {
                const maxCount = Math.max(...data.charts.intentDistribution.map((d) => d.count), 1);
                return data.charts.intentDistribution.map((d, i) => {
                  const pct = (d.count / maxCount) * 100;
                  const color = INTENT_COLORS[i % INTENT_COLORS.length];
                  return (
                    <div key={d.intent} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10">
                        <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-semibold px-2 py-1 rounded shadow-lg whitespace-nowrap">
                          {d.intent.replace(/_/g, " ")}
                          <br />
                          <span>Calls: {d.count}</span>
                        </div>
                        <div className="w-1.5 h-1.5 bg-zinc-900 dark:bg-zinc-100 rotate-45 -mt-0.5" />
                      </div>
                      <div
                        className="w-full rounded-t transition-all duration-700"
                        style={{ height: `${pct}%`, backgroundColor: color, opacity: 0.85 }}
                      />
                      <span className="text-[9px] text-zinc-400 truncate max-w-full text-center font-medium">
                        {d.intent.replace(/_/g, " ").slice(0, 8)}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-400">
              <BarChart3 className="h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-xs">No call actions recorded for this period.</p>
            </div>
          )
        ) : null}
      </ChartCard>

      {/* ── Recent Activity ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent Calls */}
        <ChartCard title="Recent Calls" icon={PhoneCall}>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
              ))}
            </div>
          ) : data && data.recentActivity.calls.length > 0 ? (
            <div className="space-y-1.5">
              {data.recentActivity.calls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between rounded-xl px-3.5 py-2.5 bg-zinc-50/50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-900"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                      {call.patientName}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {call.actionTaken?.replace(/_/g, " ") ?? "No action"} · {formatTime(call.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {call.handedOverToHuman && (
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                        Transferred
                      </span>
                    )}
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${call.callStatus === "completed" ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
                      {call.callStatus}
                    </span>
                    {call.callDuration != null && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {formatDuration(call.callDuration)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
              <PhoneCall className="h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-xs">No calls recorded yet.</p>
            </div>
          )}
        </ChartCard>

        {/* Recent Appointments */}
        <ChartCard title="Recent Appointments" icon={Calendar}>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
              ))}
            </div>
          ) : data && data.recentActivity.appointments.length > 0 ? (
            <div className="space-y-1.5">
              {data.recentActivity.appointments.map((appt) => {
                const statusColor: Record<string, string> = {
                  CONFIRMED: "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600",
                  PENDING: "bg-amber-50 dark:bg-amber-950/20 text-amber-600",
                  CANCELLED: "bg-rose-50 dark:bg-rose-950/20 text-rose-600",
                  RESCHEDULED: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600",
                };
                return (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between rounded-xl px-3.5 py-2.5 bg-zinc-50/50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-900"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {appt.patientName}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {appt.doctorName} · {formatDate(appt.dateTime)}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 capitalize ${statusColor[appt.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                      {appt.status.toLowerCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
              <CheckCircle2 className="h-8 w-8 text-zinc-300 mb-2" />
              <p className="text-xs">No appointments recorded yet.</p>
            </div>
          )}
        </ChartCard>
      </div>

    </div>
  );
}
