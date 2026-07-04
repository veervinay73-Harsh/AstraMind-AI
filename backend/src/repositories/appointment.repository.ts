import prisma, { Appointment, AppointmentStatus } from '../config/prisma';

export class AppointmentRepository {
  public static async findById(id: string): Promise<Appointment | null> {
    return prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
      },
    });
  }

  public static async findByHospital(hospitalId: string): Promise<Appointment[]> {
    return prisma.appointment.findMany({
      where: { hospitalId },
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: { dateTime: 'asc' },
    });
  }

  public static async findByDoctorAndDate(
    doctorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Appointment[]> {
    return prisma.appointment.findMany({
      where: {
        doctorId,
        dateTime: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          not: AppointmentStatus.CANCELLED,
        },
      },
      orderBy: { dateTime: 'asc' },
    });
  }

  public static async create(data: {
    patientId: string;
    doctorId: string;
    dateTime: Date;
    duration?: number;
    notes?: string;
    hospitalId: string;
    callLogId?: string;
  }): Promise<Appointment> {
    return prisma.appointment.create({
      data,
    });
  }

  public static async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    return prisma.appointment.update({
      where: { id },
      data: { status },
    });
  }

  public static async reschedule(id: string, dateTime: Date, notes?: string): Promise<Appointment> {
    return prisma.appointment.update({
      where: { id },
      data: {
        dateTime,
        status: AppointmentStatus.RESCHEDULED,
        ...(notes && { notes }),
      },
    });
  }
}
