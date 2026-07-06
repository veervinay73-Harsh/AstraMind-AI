import prisma from '../config/prisma';

export const getLatestActiveAppointmentByPhone = async (hospitalId: string, phone: string) => {
  // Find patient by phone
  const patient = await prisma.patient.findUnique({
    where: {
      hospitalId_phone: {
        hospitalId,
        phone,
      },
    },
  });

  if (!patient) {
    return null;
  }

  // Find latest active appointment for this patient
  const appointment = await prisma.appointment.findFirst({
    where: {
      patientId: patient.id,
      hospitalId,
      status: {
        in: ['CONFIRMED', 'PENDING', 'RESCHEDULED', 'DOCTOR_CHANGED'],
      },
      dateTime: {
        gte: new Date(), // Only future/upcoming appointments
      },
    },
    orderBy: {
      dateTime: 'asc', // Closest one first
    },
    include: {
      doctor: true,
      patient: true,
    },
  });

  return appointment;
};
