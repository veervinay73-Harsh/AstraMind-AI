import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { Logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/patients
 * Returns paginated list of patients with appointment metrics.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      hospitalId,
      search,
      sort = 'name',
      page = '1',
      limit = '10',
    } = req.query;

    // Resolve hospitalId
    let activeHospitalId = hospitalId as string;
    if (!activeHospitalId) {
      const firstHospital = await prisma.hospital.findFirst();
      if (firstHospital) {
        activeHospitalId = firstHospital.id;
      } else {
        res.status(400).json({ error: 'No hospitals exist in the database.' });
        return;
      }
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = { hospitalId: activeHospitalId };

    if (search) {
      const s = search as string;
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }

    // Sort by name or createdAt
    const orderBy: any =
      sort === 'recent'
        ? { createdAt: 'desc' }
        : { name: 'asc' };

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        include: {
          appointments: {
            orderBy: { dateTime: 'desc' },
            take: 1, // Only last appointment for quick metrics
            include: { doctor: true },
          },
          _count: {
            select: { appointments: true },
          },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    // Enrich each patient with metrics
    const enriched = (patients as any[]).map((pat) => {
      const lastAppt = pat.appointments[0] ?? null;
      return {
        id: pat.id,
        name: pat.name,
        phone: pat.phone,
        email: pat.email,
        dob: pat.dob,
        hospitalId: pat.hospitalId,
        createdAt: pat.createdAt,
        totalAppointments: pat._count.appointments,
        lastAppointment: lastAppt
          ? {
              id: lastAppt.id,
              dateTime: lastAppt.dateTime,
              status: lastAppt.status,
              doctorName: lastAppt.doctor?.name ?? null,
              specialization: lastAppt.doctor?.specialization ?? null,
            }
          : null,
      };
    });

    res.status(200).json({
      patients: enriched,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    Logger.error('Failed to query patients list', error, 'PATIENT_API');
    res.status(500).json({ error: 'Internal server error while fetching patients.' });
  }
});

/**
 * GET /api/patients/:id
 * Returns full patient profile: personal info, complete appointment history, and call log history.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const patientId = req.params.id as string;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        appointments: {
          orderBy: { dateTime: 'desc' },
          include: {
            doctor: true,
          },
        },
        callLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            messages: {
              orderBy: { timestamp: 'asc' },
              take: 5, // Most recent messages per call for summary
            },
          },
        },
        _count: {
          select: { appointments: true, callLogs: true },
        },
      },
    }) as any;

    if (!patient) {
      res.status(404).json({ error: 'Patient not found.' });
      return;
    }

    // Compute appointment type breakdown
    const apptsByStatus = { CONFIRMED: 0, PENDING: 0, CANCELLED: 0, RESCHEDULED: 0 };
    for (const appt of patient.appointments) {
      const s = appt.status as keyof typeof apptsByStatus;
      if (s in apptsByStatus) apptsByStatus[s]++;
    }

    res.status(200).json({
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
      email: patient.email,
      dob: patient.dob,
      hospitalId: patient.hospitalId,
      createdAt: patient.createdAt,
      stats: {
        totalAppointments: patient._count.appointments,
        totalCalls: patient._count.callLogs,
        ...apptsByStatus,
      },
      appointments: patient.appointments.map((appt: any) => ({
        id: appt.id,
        dateTime: appt.dateTime,
        status: appt.status,
        notes: appt.notes,
        duration: appt.duration,
        doctorName: appt.doctor?.name ?? null,
        specialization: appt.doctor?.specialization ?? null,
        callLogId: appt.callLogId,
      })),
      callLogs: patient.callLogs.map((log: any) => ({
        id: log.id,
        twilioCallSid: log.twilioCallSid,
        callStatus: log.callStatus,
        callDuration: log.callDuration,
        actionTaken: log.actionTaken,
        summary: log.summary,
        handedOverToHuman: log.handedOverToHuman,
        createdAt: log.createdAt,
        messageCount: log.messages.length,
        recentMessages: log.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
      })),
    });
  } catch (error) {
    Logger.error('Failed to load patient profile', error, 'PATIENT_API');
    res.status(500).json({ error: 'Internal server error while fetching patient profile.' });
  }
});

export default router;
