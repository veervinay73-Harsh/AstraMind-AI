import { AppointmentRepository } from '../repositories/appointment.repository';
import prisma from '../config/prisma';
import { AppointmentStatus } from '../generated/prisma';
import { Logger } from '../utils/logger';

export interface CancellationResult {
  status: 'CANCELLED' | 'FAILED_NOT_FOUND' | 'FAILED_INVALID_PATIENT' | 'FAILED_ALREADY_CANCELLED';
  appointmentId?: string;
  doctor?: string;
  date?: string;
  time?: string;
  message?: string;
}

export const cancelAppointment = async (
  patientPhone: string,
  hospitalId: string,
  doctorQuery?: string | null,
  targetDateStr?: string | null
): Promise<CancellationResult> => {
  try {
    // 1. Identify the patient
    const patient = await prisma.patient.findUnique({
      where: {
        hospitalId_phone: {
          hospitalId,
          phone: patientPhone,
        },
      },
    });

    if (!patient) {
      return {
        status: 'FAILED_INVALID_PATIENT',
        message: `Patient with phone ${patientPhone} does not exist in the system.`,
      };
    }

    // 2. Locate the appointment(s)
    // Find all appointments for this patient
    const appointments = await prisma.appointment.findMany({
      where: {
        patientId: patient.id,
        hospitalId,
      },
      include: {
        doctor: true,
      },
      orderBy: {
        dateTime: 'asc',
      },
    });

    if (appointments.length === 0) {
      return {
        status: 'FAILED_NOT_FOUND',
        message: 'No appointments found for this patient.',
      };
    }

    // Filter appointments by doctorQuery or targetDateStr if provided
    let filtered = appointments;

    if (doctorQuery || targetDateStr) {
      filtered = appointments.filter((appt) => {
        let match = true;
        if (doctorQuery) {
          match = match && (
            appt.doctor.name.toLowerCase().includes(doctorQuery.toLowerCase()) ||
            appt.doctor.specialization.toLowerCase().includes(doctorQuery.toLowerCase())
          );
        }
        if (targetDateStr) {
          const apptDateStr = appt.dateTime.toISOString().substring(0, 10);
          match = match && (apptDateStr === targetDateStr);
        }
        return match;
      });
    }

    if (filtered.length === 0) {
      return {
        status: 'FAILED_NOT_FOUND',
        message: `No appointment found matching criteria: Doctor/Specialty: "${doctorQuery || 'any'}", Date: "${targetDateStr || 'any'}".`,
      };
    }

    // Pick the matching appointment
    const targetAppt = filtered[0];

    // 3. Validate cancellation eligibility
    if (targetAppt.status === AppointmentStatus.CANCELLED) {
      return {
        status: 'FAILED_ALREADY_CANCELLED',
        appointmentId: targetAppt.id,
        doctor: targetAppt.doctor.name,
        message: 'This appointment has already been cancelled.',
      };
    }

    // 4. Cancel the appointment using the Repository Layer
    await AppointmentRepository.updateStatus(targetAppt.id, AppointmentStatus.CANCELLED);

    Logger.info(`Appointment cancelled successfully! ID: ${targetAppt.id} - Doctor: ${targetAppt.doctor.name}`, 'CANCELLATION_ENGINE');

    // Format date and time for response
    const datePart = targetAppt.dateTime.toISOString().substring(0, 10);
    const hrs = targetAppt.dateTime.getUTCHours();
    const mins = targetAppt.dateTime.getUTCMinutes();
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    const hrs12 = hrs % 12 || 12;
    const timePart = `${hrs12}:${String(mins).padStart(2, '0')} ${ampm}`;

    return {
      status: 'CANCELLED',
      appointmentId: targetAppt.id,
      doctor: targetAppt.doctor.name,
      date: datePart,
      time: timePart,
    };
  } catch (error) {
    Logger.error('Failed to cancel appointment', error, 'CANCELLATION_ENGINE');
    return {
      status: 'FAILED_NOT_FOUND',
      message: 'Internal server error during appointment cancellation.',
    };
  }
};
