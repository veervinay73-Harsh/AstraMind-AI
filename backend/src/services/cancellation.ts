import prisma from '../config/prisma';
import { Logger } from '../utils/logger';
import { getLatestActiveAppointmentByPhone } from './appointmentHelper';

export interface CancellationResult {
  status: 'CANCELLED' | 'FAILED_NOT_FOUND' | 'FAILED_INVALID_PATIENT' | 'FAILED_ALREADY_CANCELLED';
  appointmentId?: string;
  doctor?: string;
  date?: string;
  time?: string;
  message?: string;
}

export const cancelAppointment = async (
  callSid: string,
  hospitalId: string,
  callerPhone: string
): Promise<CancellationResult> => {
  try {
    // 1. Locate the active appointment using phone number
    const appointment = await getLatestActiveAppointmentByPhone(hospitalId, callerPhone);

    if (!appointment) {
      return {
        status: 'FAILED_NOT_FOUND',
        message: 'No active appointment found for this patient.',
      };
    }

    if (appointment.status === 'CANCELLED') {
      return {
        status: 'FAILED_ALREADY_CANCELLED',
        appointmentId: appointment.id,
        doctor: appointment.doctor.name,
        message: 'This appointment has already been cancelled.',
      };
    }

    // 2. Cancel the appointment
    const updatedAppt = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'Cancelled by patient via AI receptionist voice call.',
      },
    });

    Logger.info(`Appointment cancelled successfully! ID: ${updatedAppt.id} - Doctor: ${appointment.doctor.name}`, 'CANCELLATION_ENGINE');

    // 3. Record Call Log and Action Taken
    await prisma.callLog.upsert({
      where: { twilioCallSid: callSid },
      update: { actionTaken: 'Appointment Cancelled' },
      create: {
        twilioCallSid: callSid,
        hospitalId,
        callStatus: 'in-progress',
        actionTaken: 'Appointment Cancelled',
        patientId: appointment.patientId,
      },
    });

    // Format date and time for response
    const datePart = appointment.dateTime.toISOString().substring(0, 10);
    const hrs = appointment.dateTime.getUTCHours();
    const mins = appointment.dateTime.getUTCMinutes();
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    const hrs12 = hrs % 12 || 12;
    const timePart = `${hrs12}:${String(mins).padStart(2, '0')} ${ampm}`;

    return {
      status: 'CANCELLED',
      appointmentId: appointment.id,
      doctor: appointment.doctor.name,
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
