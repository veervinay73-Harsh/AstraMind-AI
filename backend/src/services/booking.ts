import { AppointmentRepository } from '../repositories/appointment.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { getDoctorAvailability } from './availability';
import { BookingState } from './stateManager';
import prisma from '../config/prisma';
import { Logger } from '../utils/logger';

export interface BookingResult {
  status: 'BOOKED' | 'FAILED_SLOT_OCCUPIED' | 'FAILED_DOCTOR_NOT_FOUND' | 'FAILED_MISSING_FIELDS' | 'FAILED_INTERNAL_ERROR';
  appointmentId?: string;
  doctor?: string;
  department?: string;
  date?: string;
  time?: string;
  message?: string;
}

export const bookAppointment = async (
  _callSid: string,
  state: BookingState,
  hospitalId: string
): Promise<BookingResult> => {
  try {
    // 1. Verify all required booking fields are present
    const required: (keyof BookingState)[] = ['doctor', 'date', 'time', 'patient_name', 'phone'];
    const missing = required.filter((field) => !state[field]);
    if (missing.length > 0) {
      return {
        status: 'FAILED_MISSING_FIELDS',
        message: `Missing required booking fields: ${missing.join(', ')}`,
      };
    }

    const doctorQuery = state.doctor!;
    const dateStr = state.date!; // e.g. '2026-07-04'
    const timeStr = state.time!; // e.g. '10:00 AM'

    // 2. Query Doctor Availability Engine
    const availabilities = await getDoctorAvailability(doctorQuery, dateStr);
    if (availabilities.length === 0) {
      return {
        status: 'FAILED_DOCTOR_NOT_FOUND',
        message: `No doctor found matching query: "${doctorQuery}"`,
      };
    }

    // Pick the first matching doctor
    const docAvail = availabilities[0];
    const doctorId = docAvail.doctorId;

    // 3. Parse requested time slot and check if available
    let hours = 0;
    let minutes = 0;
    
    // Robust parser for "10:00 AM", "2:30 PM", "14:00"
    const timeLower = timeStr.toLowerCase();
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
    const requestedSlot = `${dateStr}T${formattedHours}:${formattedMinutes}:00`;

    // Check if requestedSlot exists in docAvail.availableSlots
    const isSlotAvailable = docAvail.availableSlots.includes(requestedSlot);
    if (!isSlotAvailable) {
      return {
        status: 'FAILED_SLOT_OCCUPIED',
        message: `Requested slot "${requestedSlot}" is occupied or outside doctor working hours.`,
      };
    }

    // 4. Find or Create Patient profile
    const patientName = state.patient_name!;
    const patientPhone = state.phone!;

    let patient = await prisma.patient.findUnique({
      where: {
        hospitalId_phone: {
          hospitalId,
          phone: patientPhone,
        },
      },
    });

    if (!patient) {
      Logger.info(`Patient profile not found. Registering patient: ${patientName} (${patientPhone})`, 'BOOKING_ENGINE');
      patient = await PatientRepository.create({
        name: patientName,
        phone: patientPhone,
        hospitalId,
      });
    }

    // 5. Create appointment in DB
    const dateParts = dateStr.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);
    const appointmentDate = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));

    const newAppointment = await AppointmentRepository.create({
      patientId: patient.id,
      doctorId,
      dateTime: appointmentDate,
      duration: 30,
      hospitalId,
      notes: 'Booked via AstraMind AI voice assistant.',
    });

    Logger.info(`Appointment booked successfully! ID: ${newAppointment.id} - Doctor: ${docAvail.doctorName} at ${requestedSlot}`, 'BOOKING_ENGINE');

    return {
      status: 'BOOKED',
      appointmentId: newAppointment.id,
      doctor: docAvail.doctorName,
      department: docAvail.specialization,
      date: dateStr,
      time: timeStr,
    };
  } catch (error) {
    Logger.error('Failed to book appointment', error, 'BOOKING_ENGINE');
    return {
      status: 'FAILED_INTERNAL_ERROR',
      message: 'Internal server error during appointment booking.',
    };
  }
};
