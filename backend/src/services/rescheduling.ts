import prisma from '../config/prisma';
import { Logger } from '../utils/logger';
import { getLatestActiveAppointmentByPhone } from './appointmentHelper';

export interface RescheduleResult {
  status: 'RESCHEDULED' | 'FAILED_SLOT_OCCUPIED' | 'FAILED_DOCTOR_NOT_FOUND' | 'FAILED_NOT_FOUND' | 'FAILED_INVALID_PATIENT' | 'FAILED_MISSING_FIELDS';
  appointmentId?: string;
  doctor?: string;
  old_date?: string;
  old_time?: string;
  new_date?: string;
  new_time?: string;
  message?: string;
}

export const rescheduleAppointment = async (
  callSid: string,
  hospitalId: string,
  callerPhone: string,
  newDateStr: string | null | undefined,
  newTimeStr: string | null | undefined
): Promise<RescheduleResult> => {
  try {
    // 1. Verify required fields are present
    if (!newDateStr || !newTimeStr) {
      return {
        status: 'FAILED_MISSING_FIELDS',
        message: 'Missing required fields for rescheduling.',
      };
    }

    // 2. Locate the existing active appointment using phone number
    const appointment = await getLatestActiveAppointmentByPhone(hospitalId, callerPhone);

    if (!appointment) {
      return {
        status: 'FAILED_NOT_FOUND',
        message: 'No active appointment found for this patient.',
      };
    }

    // 3. Parse requested new time slot
    let hours = 0;
    let minutes = 0;
    const timeLower = newTimeStr.toLowerCase();
    const isPm = timeLower.includes('pm');
    const isAm = timeLower.includes('am');
    const timeClean = timeLower.replace(/am|pm/g, '').trim();
    const parts = timeClean.split(':');
    
    if (parts.length >= 1) {
      hours = parseInt(parts[0], 10);
      if (isPm && hours < 12) hours += 12;
      if (isAm && hours === 12) hours = 0;
    }
    if (parts.length >= 2) {
      minutes = parseInt(parts[1], 10);
    }

    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    const requestedSlot = `${newDateStr}T${formattedHours}:${formattedMinutes}:00`;

    const dateParts = newDateStr.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);
    const newAppointmentDate = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));

    // Update appointment
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        previousDateTime: appointment.dateTime,
        dateTime: newAppointmentDate,
        status: 'RESCHEDULED',
        notes: `Rescheduled via AstraMind AI voice assistant from ${appointment.dateTime.toISOString().substring(0, 10)}.`,
      },
    });

    Logger.info(`Appointment rescheduled successfully! ID: ${appointment.id} - Doctor: ${appointment.doctor.name} to ${requestedSlot}`, 'RESCHEDULING_ENGINE');

    // 4. Record Call Log and Action Taken
    await prisma.callLog.upsert({
      where: { twilioCallSid: callSid },
      update: { actionTaken: 'Appointment Rescheduled' },
      create: {
        twilioCallSid: callSid,
        hospitalId,
        callStatus: 'in-progress',
        actionTaken: 'Appointment Rescheduled',
        patientId: appointment.patientId,
      },
    });

    // Format old date and time for response
    const oldDatePart = appointment.dateTime.toISOString().substring(0, 10);
    const oldHrs = appointment.dateTime.getUTCHours();
    const oldMins = appointment.dateTime.getUTCMinutes();
    const oldAmpm = oldHrs >= 12 ? 'PM' : 'AM';
    const oldHrs12 = oldHrs % 12 || 12;
    const oldTimePart = `${oldHrs12}:${String(oldMins).padStart(2, '0')} ${oldAmpm}`;

    return {
      status: 'RESCHEDULED',
      appointmentId: appointment.id,
      doctor: appointment.doctor.name,
      old_date: oldDatePart,
      old_time: oldTimePart,
      new_date: newDateStr,
      new_time: newTimeStr,
    };
  } catch (error) {
    Logger.error('Failed to reschedule appointment', error, 'RESCHEDULING_ENGINE');
    return {
      status: 'FAILED_NOT_FOUND',
      message: 'Internal server error during appointment rescheduling.',
    };
  }
};
