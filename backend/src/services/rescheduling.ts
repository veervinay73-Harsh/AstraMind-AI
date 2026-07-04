import { AppointmentRepository } from '../repositories/appointment.repository';
import { getDoctorAvailability } from './availability';
import prisma from '../config/prisma';
import { Logger } from '../utils/logger';

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
  patientPhone: string,
  hospitalId: string,
  newDateStr: string | null | undefined,
  newTimeStr: string | null | undefined,
  doctorQuery?: string | null
): Promise<RescheduleResult> => {
  try {
    // 1. Verify required fields are present
    if (!patientPhone || !hospitalId || !newDateStr || !newTimeStr) {
      return {
        status: 'FAILED_MISSING_FIELDS',
        message: 'Missing required fields for rescheduling: patientPhone, hospitalId, newDateStr, and newTimeStr are required.',
      };
    }

    // 2. Identify the patient
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

    // 3. Locate the existing appointment
    const appointments = await prisma.appointment.findMany({
      where: {
        patientId: patient.id,
        hospitalId,
        status: {
          not: 'CANCELLED',
        },
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
        message: 'No active appointments found for this patient to reschedule.',
      };
    }

    let targetAppt = appointments[0];
    if (doctorQuery) {
      const filtered = appointments.filter((appt) =>
        appt.doctor.name.toLowerCase().includes(doctorQuery.toLowerCase()) ||
        appt.doctor.specialization.toLowerCase().includes(doctorQuery.toLowerCase())
      );
      if (filtered.length === 0) {
        return {
          status: 'FAILED_NOT_FOUND',
          message: `No active appointment found for doctor/specialization: "${doctorQuery}".`,
        };
      }
      targetAppt = filtered[0];
    }

    // 4. Retrieve doctor's available slots on the new date
    const doctorName = targetAppt.doctor.name;
    const availabilities = await getDoctorAvailability(doctorName, newDateStr);
    if (availabilities.length === 0) {
      return {
        status: 'FAILED_DOCTOR_NOT_FOUND',
        message: `Doctor "${doctorName}" was not found or is inactive.`,
      };
    }

    const docAvail = availabilities[0];

    // 5. Parse requested new time slot
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

    // 6. Validate the requested new slot is available
    const isSlotAvailable = docAvail.availableSlots.includes(requestedSlot);
    if (!isSlotAvailable) {
      return {
        status: 'FAILED_SLOT_OCCUPIED',
        message: `Requested slot "${requestedSlot}" is occupied or outside doctor working hours.`,
      };
    }

    // 7. Update the appointment using the Repository Layer
    const dateParts = newDateStr.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);
    const newAppointmentDate = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));

    await AppointmentRepository.reschedule(
      targetAppt.id,
      newAppointmentDate,
      `Rescheduled via AstraMind AI voice assistant from ${targetAppt.dateTime.toISOString().substring(0, 10)}.`
    );

    Logger.info(`Appointment rescheduled successfully! ID: ${targetAppt.id} - Doctor: ${doctorName} to ${requestedSlot}`, 'RESCHEDULING_ENGINE');

    // Format old date and time for response
    const oldDatePart = targetAppt.dateTime.toISOString().substring(0, 10);
    const oldHrs = targetAppt.dateTime.getUTCHours();
    const oldMins = targetAppt.dateTime.getUTCMinutes();
    const oldAmpm = oldHrs >= 12 ? 'PM' : 'AM';
    const oldHrs12 = oldHrs % 12 || 12;
    const oldTimePart = `${oldHrs12}:${String(oldMins).padStart(2, '0')} ${oldAmpm}`;

    return {
      status: 'RESCHEDULED',
      appointmentId: targetAppt.id,
      doctor: doctorName,
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
