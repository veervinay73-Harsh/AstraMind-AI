import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { Logger } from '../utils/logger';
import { getDoctorAvailability } from '../services/availability';

const router = Router();

/**
 * GET /api/doctors
 * Retrieves a list of doctors with their workload metrics and search/filtering/pagination.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      hospitalId, 
      search, 
      isActive, 
      sort = 'name', 
      page = '1', 
      limit = '10' 
    } = req.query;

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

    // Build Prisma query filters
    const where: any = {
      hospitalId: activeHospitalId,
    };

    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    if (search) {
      const searchStr = search as string;
      where.OR = [
        { name: { contains: searchStr, mode: 'insensitive' } },
        { specialization: { contains: searchStr, mode: 'insensitive' } },
      ];
    }

    // Query doctors
    const doctors = await prisma.doctor.findMany({
      where,
      orderBy: sort === 'name' ? { name: 'asc' } : undefined,
    });

    // Calculate workloads and next available slots for each doctor
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const doctorsWithMetrics = await Promise.all(
      doctors.map(async (doc) => {
        // Today's Appointments Count
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const todayAppointmentsCount = await prisma.appointment.count({
          where: {
            doctorId: doc.id,
            dateTime: {
              gte: startOfToday,
              lte: endOfToday,
            },
            status: { not: 'CANCELLED' },
          },
        });

        // Next Available Slot calculation
        let nextAvailableSlot = 'None today';
        try {
          const availabilities = await getDoctorAvailability(doc.name, todayStr);
          const doctorAvail = availabilities.find((a) => a.doctorId === doc.id);
          if (doctorAvail && doctorAvail.availableSlots.length > 0) {
            // Find first slot after current time
            const upcomingSlots = doctorAvail.availableSlots.filter((slotStr) => {
              const slotTime = new Date(slotStr + 'Z').getTime();
              return slotTime > now.getTime();
            });

            if (upcomingSlots.length > 0) {
              const nextTime = new Date(upcomingSlots[0] + 'Z');
              nextAvailableSlot = nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          }
          
          // If no slots left today, check tomorrow
          if (nextAvailableSlot === 'None today') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            const tomorrowAvailabilities = await getDoctorAvailability(doc.name, tomorrowStr);
            const tomorrowAvail = tomorrowAvailabilities.find((a) => a.doctorId === doc.id);
            if (tomorrowAvail && tomorrowAvail.availableSlots.length > 0) {
              const nextTime = new Date(tomorrowAvail.availableSlots[0] + 'Z');
              nextAvailableSlot = 'Tomorrow, ' + nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          }
        } catch (err) {
          Logger.error(`Failed to calculate next slot for Dr. ${doc.name}`, err, 'DOCTOR_API');
        }

        return {
          ...doc,
          todayAppointmentsCount,
          nextAvailableSlot,
        };
      })
    );

    // Apply custom sort for workload (Today's Appointment Count)
    if (sort === 'workload') {
      doctorsWithMetrics.sort((a, b) => b.todayAppointmentsCount - a.todayAppointmentsCount);
    }

    // Apply manual pagination on enriched array
    const paginatedDoctors = doctorsWithMetrics.slice(skip, skip + limitNum);
    const total = doctorsWithMetrics.length;

    res.status(200).json({
      doctors: paginatedDoctors,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    Logger.error('Failed to query doctors list with metrics', error, 'DOCTOR_API');
    res.status(500).json({ error: 'Internal server error while fetching doctors.' });
  }
});

/**
 * GET /api/doctors/:id/availability
 * Returns availability, occupied slots, and working hours for a specific doctor.
 */
router.get('/:id/availability', async (req: Request, res: Response) => {
  try {
    const idStr = req.params.id as string;
    const dateQuery = req.query.date; // format: YYYY-MM-DD

    if (!dateQuery) {
      res.status(400).json({ error: 'Missing required date query parameter.' });
      return;
    }

    const doc = await prisma.doctor.findUnique({
      where: { id: idStr },
    });

    if (!doc) {
      res.status(404).json({ error: 'Doctor not found.' });
      return;
    }

    // Parse the date
    const dateStr = dateQuery as string;
    const dateParts = dateStr.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);

    const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

    // Get occupied slots (cast to any[] to bypass strict Prisma type inference lockups)
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: idStr,
        dateTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { not: 'CANCELLED' },
      },
      include: {
        patient: true,
      },
    }) as any[];

    // Get available slots using existing engine
    const availabilities = await getDoctorAvailability(doc.name, dateStr);
    const doctorAvail = availabilities.find((a) => a.doctorId === idStr);
    const availableSlots = doctorAvail ? doctorAvail.availableSlots : [];

    // Get upcoming appointments overall
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: idStr,
        dateTime: { gte: new Date() },
        status: { not: 'CANCELLED' },
      },
      include: {
        patient: true,
      },
      orderBy: { dateTime: 'asc' },
      take: 5,
    }) as any[];

    res.status(200).json({
      doctorId: idStr,
      date: dateStr,
      workingHours: '9:00 AM - 5:00 PM',
      availableSlots,
      occupiedSlots: appointments.map((appt) => ({
        id: appt.id,
        time: appt.dateTime.toISOString().substring(11, 16),
        patientName: appt.patient?.name || 'Anonymous',
        status: appt.status,
      })),
      upcomingAppointments: upcomingAppointments.map((appt) => ({
        id: appt.id,
        dateTime: appt.dateTime.toISOString(),
        patientName: appt.patient?.name || 'Anonymous',
        status: appt.status,
      })),
    });
  } catch (error) {
    Logger.error('Failed to load doctor availability details', error, 'DOCTOR_API');
    res.status(500).json({ error: 'Internal server error while fetching doctor availability.' });
  }
});

export default router;
