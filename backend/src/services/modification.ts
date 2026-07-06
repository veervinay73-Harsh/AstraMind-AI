import prisma from '../config/prisma';
import { Logger } from '../utils/logger';

export interface ModificationResult {
  status: 'SUCCESS' | 'FAILED_NOT_FOUND' | 'FAILED_MISSING_FIELDS';
  appointmentId?: string;
  doctor?: string;
  date?: string;
  time?: string;
  message?: string;
}

export const changeDoctor = async (
  callSid: string,
  appointmentId: string,
  newDoctorId: string,
  hospitalId: string
): Promise<ModificationResult> => {
  try {
    if (!appointmentId || !newDoctorId) {
      return { status: 'FAILED_MISSING_FIELDS', message: 'Missing appointment ID or doctor ID.' };
    }

    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true }
    });

    if (!appt) {
      return { status: 'FAILED_NOT_FOUND', message: 'Appointment not found.' };
    }

    const doctor = await prisma.doctor.findUnique({ where: { id: newDoctorId } });
    if (!doctor) {
      return { status: 'FAILED_NOT_FOUND', message: 'Doctor not found.' };
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        doctorId: newDoctorId,
        status: 'DOCTOR_CHANGED',
        department: doctor.specialization
      },
      include: { doctor: true }
    });

    // Record Call Log and Action Taken
    await prisma.callLog.upsert({
      where: { twilioCallSid: callSid },
      update: { actionTaken: 'Doctor Changed' },
      create: {
        twilioCallSid: callSid,
        hospitalId,
        callStatus: 'in-progress',
        actionTaken: 'Doctor Changed',
        patientId: appt.patientId,
      },
    });

    Logger.info(`Doctor changed successfully for appointment ${appointmentId} to ${doctor.name}`, 'MODIFICATION_ENGINE');

    return {
      status: 'SUCCESS',
      appointmentId: updated.id,
      doctor: updated.doctor.name,
    };
  } catch (error) {
    Logger.error('Failed to change doctor', error, 'MODIFICATION_ENGINE');
    return { status: 'FAILED_NOT_FOUND', message: 'Internal server error.' };
  }
};

export const changeDate = async (
  callSid: string,
  appointmentId: string,
  newDateStr: string,
  hospitalId: string
): Promise<ModificationResult> => {
  try {
    if (!appointmentId || !newDateStr) {
      return { status: 'FAILED_MISSING_FIELDS', message: 'Missing appointment ID or new date.' };
    }

    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: true }
    });

    if (!appt) {
      return { status: 'FAILED_NOT_FOUND', message: 'Appointment not found.' };
    }

    // Preserve time components, only update year, month, date
    const dateParts = newDateStr.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);

    const oldDate = new Date(appt.dateTime);
    const newAppointmentDate = new Date(Date.UTC(
      year,
      month,
      day,
      oldDate.getUTCHours(),
      oldDate.getUTCMinutes(),
      0,
      0
    ));

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        previousDateTime: appt.dateTime,
        dateTime: newAppointmentDate,
        status: 'RESCHEDULED',
      }
    });

    // Record Call Log and Action Taken
    await prisma.callLog.upsert({
      where: { twilioCallSid: callSid },
      update: { actionTaken: 'Date Changed' },
      create: {
        twilioCallSid: callSid,
        hospitalId,
        callStatus: 'in-progress',
        actionTaken: 'Date Changed',
        patientId: appt.patientId,
      },
    });

    Logger.info(`Date changed successfully for appointment ${appointmentId} to ${newDateStr}`, 'MODIFICATION_ENGINE');

    return {
      status: 'SUCCESS',
      appointmentId: appt.id,
      doctor: appt.doctor.name,
      date: newDateStr,
    };
  } catch (error) {
    Logger.error('Failed to change date', error, 'MODIFICATION_ENGINE');
    return { status: 'FAILED_NOT_FOUND', message: 'Internal server error.' };
  }
};

export const changeTime = async (
  callSid: string,
  appointmentId: string,
  newTimeStr: string,
  hospitalId: string
): Promise<ModificationResult> => {
  try {
    if (!appointmentId || !newTimeStr) {
      return { status: 'FAILED_MISSING_FIELDS', message: 'Missing appointment ID or new time.' };
    }

    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: true }
    });

    if (!appt) {
      return { status: 'FAILED_NOT_FOUND', message: 'Appointment not found.' };
    }

    // Parse time
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

    const oldDate = new Date(appt.dateTime);
    const newAppointmentDate = new Date(Date.UTC(
      oldDate.getUTCFullYear(),
      oldDate.getUTCMonth(),
      oldDate.getUTCDate(),
      hours,
      minutes,
      0,
      0
    ));

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        previousDateTime: appt.dateTime,
        dateTime: newAppointmentDate,
        status: 'RESCHEDULED',
      }
    });

    // Record Call Log and Action Taken
    await prisma.callLog.upsert({
      where: { twilioCallSid: callSid },
      update: { actionTaken: 'Time Changed' },
      create: {
        twilioCallSid: callSid,
        hospitalId,
        callStatus: 'in-progress',
        actionTaken: 'Time Changed',
        patientId: appt.patientId,
      },
    });

    Logger.info(`Time changed successfully for appointment ${appointmentId} to ${newTimeStr}`, 'MODIFICATION_ENGINE');

    return {
      status: 'SUCCESS',
      appointmentId: appt.id,
      doctor: appt.doctor.name,
      time: newTimeStr,
    };
  } catch (error) {
    Logger.error('Failed to change time', error, 'MODIFICATION_ENGINE');
    return { status: 'FAILED_NOT_FOUND', message: 'Internal server error.' };
  }
};
