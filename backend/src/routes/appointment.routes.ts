import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { Logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/appointments
 * Retrieves a list of filtered, searched, and paginated appointments for the hospital.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      hospitalId, 
      search, 
      status, 
      doctorId, 
      date, 
      sort = 'asc', 
      page = '1', 
      limit = '10' 
    } = req.query;

    // Sanitize sort direction — only accept 'asc' or 'desc' to prevent Prisma crashes
    const sortDirection: 'asc' | 'desc' = (sort as string) === 'desc' ? 'desc' : 'asc';

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

    const where: any = {
      hospitalId: activeHospitalId,
    };

    if (status) {
      where.status = status as any;
    }

    if (doctorId) {
      where.doctorId = doctorId as string;
    }

    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      where.dateTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (search) {
      const searchStr = search as string;
      where.OR = [
        {
          patient: {
            name: { contains: searchStr, mode: 'insensitive' },
          },
        },
        {
          patient: {
            phone: { contains: searchStr, mode: 'insensitive' },
          },
        },
        {
          doctor: {
            name: { contains: searchStr, mode: 'insensitive' },
          },
        },
      ];
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: {
        dateTime: sortDirection,
      },
      skip,
      take: limitNum,
    });

    const total = await prisma.appointment.count({ where });

    res.status(200).json({
      appointments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      }
    });
  } catch (error) {
    Logger.error('Failed to query appointments list', error, 'APPOINTMENT_API');
    res.status(500).json({ error: 'Internal server error while fetching appointments.' });
  }
});

export default router;
