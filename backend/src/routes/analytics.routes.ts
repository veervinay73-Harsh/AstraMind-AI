import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { Logger } from '../utils/logger';

const router = Router();

// ── Helper: resolve hospitalId ────────────────────────────────────────────────
async function resolveHospitalId(hospitalId?: string): Promise<string | null> {
  if (hospitalId) return hospitalId;
  const first = await prisma.hospital.findFirst();
  return first?.id ?? null;
}

// ── Helper: date range from period string ─────────────────────────────────────
function getDateRange(
  period: string,
  customFrom?: string,
  customTo?: string
): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);

  if (period === 'custom' && customFrom && customTo) {
    return {
      from: new Date(`${customFrom}T00:00:00.000Z`),
      to: new Date(`${customTo}T23:59:59.999Z`),
    };
  }

  const from = new Date();
  from.setHours(0, 0, 0, 0);

  if (period === '7d') {
    from.setDate(from.getDate() - 6);
  } else if (period === '30d') {
    from.setDate(from.getDate() - 29);
  }
  // Default: 'today' — already set to start of today

  return { from, to };
}

/**
 * GET /api/analytics
 * Returns all KPI metrics, chart data, and recent activity for the given period.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      hospitalId,
      period = 'today',
      from: customFrom,
      to: customTo,
    } = req.query;

    const activeHospitalId = await resolveHospitalId(hospitalId as string);
    if (!activeHospitalId) {
      res.status(400).json({ error: 'No hospitals exist in the database.' });
      return;
    }

    const { from, to } = getDateRange(
      period as string,
      customFrom as string,
      customTo as string
    );

    const dateFilter = { gte: from, lte: to };

    // ── 1. KPI Metrics ──────────────────────────────────────────────────────

    const [
      totalCalls,
      activeCalls,
      humanHandoffs,
      totalAppointments,
      bookedAppointments,
      cancelledAppointments,
      rescheduledAppointments,
      allCallDurations,
    ] = await Promise.all([
      // Total calls in period
      prisma.callLog.count({
        where: { hospitalId: activeHospitalId, createdAt: dateFilter },
      }),
      // Active calls (in-progress)
      prisma.callLog.count({
        where: { hospitalId: activeHospitalId, callStatus: 'in-progress' },
      }),
      // Human handoffs
      prisma.callLog.count({
        where: {
          hospitalId: activeHospitalId,
          handedOverToHuman: true,
          createdAt: dateFilter,
        },
      }),
      // Total appointments in period
      prisma.appointment.count({
        where: { hospitalId: activeHospitalId, createdAt: dateFilter },
      }),
      // Booked/confirmed
      prisma.appointment.count({
        where: {
          hospitalId: activeHospitalId,
          status: 'CONFIRMED',
          createdAt: dateFilter,
        },
      }),
      // Cancelled
      prisma.appointment.count({
        where: {
          hospitalId: activeHospitalId,
          status: 'CANCELLED',
          createdAt: dateFilter,
        },
      }),
      // Rescheduled
      prisma.appointment.count({
        where: {
          hospitalId: activeHospitalId,
          status: 'RESCHEDULED',
          createdAt: dateFilter,
        },
      }),
      // Call durations for avg calculation
      prisma.callLog.findMany({
        where: {
          hospitalId: activeHospitalId,
          callDuration: { not: null },
          createdAt: dateFilter,
        },
        select: { callDuration: true },
      }),
    ]);

    // Avg call duration
    const durations = allCallDurations
      .map((c) => c.callDuration ?? 0)
      .filter((d) => d > 0);
    const avgCallDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    // AI Success Rate = completed calls without human handoff / total completed
    const completedCalls = await prisma.callLog.count({
      where: {
        hospitalId: activeHospitalId,
        callStatus: 'completed',
        createdAt: dateFilter,
      },
    });
    const successRate =
      completedCalls > 0
        ? Math.round(((completedCalls - humanHandoffs) / completedCalls) * 100)
        : 0;

    // ── 2. Calls Per Day ─────────────────────────────────────────────────────
    const allCallsInPeriod = await prisma.callLog.findMany({
      where: { hospitalId: activeHospitalId, createdAt: dateFilter },
      select: { createdAt: true, handedOverToHuman: true },
    });

    // Build day buckets
    const dayBuckets: Record<string, { calls: number; handoffs: number }> = {};
    const dayCount = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1;
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      dayBuckets[key] = { calls: 0, handoffs: 0 };
    }
    for (const call of allCallsInPeriod) {
      const key = call.createdAt.toISOString().split('T')[0];
      if (dayBuckets[key]) {
        dayBuckets[key].calls++;
        if (call.handedOverToHuman) dayBuckets[key].handoffs++;
      }
    }
    const callsPerDay = Object.entries(dayBuckets).map(([date, v]) => ({
      date,
      calls: v.calls,
      handoffs: v.handoffs,
    }));

    // ── 3. Calls By Hour ─────────────────────────────────────────────────────
    const hourBuckets: number[] = Array(24).fill(0);
    for (const call of allCallsInPeriod) {
      const h = call.createdAt.getHours();
      hourBuckets[h]++;
    }
    const callsByHour = hourBuckets.map((count, hour) => ({ hour, count }));

    // ── 4. Appointment Status Distribution ───────────────────────────────────
    const apptsByStatus = await prisma.appointment.groupBy({
      by: ['status'],
      where: { hospitalId: activeHospitalId, createdAt: dateFilter },
      _count: { _all: true },
    });
    const appointmentDistribution = apptsByStatus.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));

    // ── 5. Doctor Workload ───────────────────────────────────────────────────
    const doctorWorkload = await prisma.appointment.groupBy({
      by: ['doctorId'],
      where: { hospitalId: activeHospitalId, createdAt: dateFilter },
      _count: { _all: true },
      orderBy: { _count: { doctorId: 'desc' } },
      take: 8,
    });

    const doctorIds = doctorWorkload.map((d) => d.doctorId);
    const doctors = await prisma.doctor.findMany({
      where: { id: { in: doctorIds } },
      select: { id: true, name: true, specialization: true },
    });
    const doctorMap = new Map(doctors.map((d) => [d.id, d]));

    const doctorWorkloadData = doctorWorkload.map((row) => ({
      doctorId: row.doctorId,
      doctorName: doctorMap.get(row.doctorId)?.name ?? 'Unknown',
      specialization: doctorMap.get(row.doctorId)?.specialization ?? '',
      count: row._count._all,
    }));

    // ── 6. AI Intent Distribution (from actionTaken field) ──────────────────
    const intentRows = await prisma.callLog.groupBy({
      by: ['actionTaken'],
      where: {
        hospitalId: activeHospitalId,
        createdAt: dateFilter,
        actionTaken: { not: null },
      },
      _count: { _all: true },
    });
    const intentDistribution = intentRows.map((row) => ({
      intent: row.actionTaken ?? 'UNKNOWN',
      count: row._count._all,
    }));

    // ── 7. Recent Activity ───────────────────────────────────────────────────
    const [recentCalls, recentAppointments] = await Promise.all([
      prisma.callLog.findMany({
        where: { hospitalId: activeHospitalId },
        include: { patient: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.appointment.findMany({
        where: { hospitalId: activeHospitalId },
        include: { patient: true, doctor: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const recentCallsFormatted = (recentCalls as any[]).map((c) => ({
      id: c.id,
      patientName: c.patient?.name ?? 'Unknown Caller',
      callStatus: c.callStatus,
      actionTaken: c.actionTaken,
      callDuration: c.callDuration,
      handedOverToHuman: c.handedOverToHuman,
      createdAt: c.createdAt,
    }));

    const recentAppointmentsFormatted = (recentAppointments as any[]).map((a) => ({
      id: a.id,
      patientName: a.patient?.name ?? 'Unknown',
      doctorName: a.doctor?.name ?? 'Unknown',
      specialization: a.doctor?.specialization ?? '',
      dateTime: a.dateTime,
      status: a.status,
      createdAt: a.createdAt,
    }));

    res.status(200).json({
      period: { label: period, from: from.toISOString(), to: to.toISOString() },
      kpis: {
        totalCalls,
        activeCalls,
        bookedAppointments,
        cancelledAppointments,
        rescheduledAppointments,
        totalAppointments,
        humanHandoffs,
        avgCallDuration,
        successRate,
        completedCalls,
      },
      charts: {
        callsPerDay,
        callsByHour,
        appointmentDistribution,
        doctorWorkload: doctorWorkloadData,
        intentDistribution,
      },
      recentActivity: {
        calls: recentCallsFormatted,
        appointments: recentAppointmentsFormatted,
      },
    });
  } catch (error) {
    Logger.error('Failed to compute analytics', error, 'ANALYTICS_API');
    res.status(500).json({ error: 'Internal server error while computing analytics.' });
  }
});

export default router;
