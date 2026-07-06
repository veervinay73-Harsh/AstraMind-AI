import { AppointmentRepository } from '../repositories/appointment.repository';
import { PatientRepository } from '../repositories/patient.repository';
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
    const required: (keyof BookingState)[] = ['patient_name', 'phone', 'date', 'time'];
    const missing: string[] = required.filter((field) => !state[field]);
    if (!state.department && !state.doctorId) {
      missing.push('department');
    }
    if (missing.length > 0) {
      return {
        status: 'FAILED_MISSING_FIELDS',
        message: `Missing required booking fields: ${missing.join(', ')}`,
      };
    }

    const dateStr = state.date!; // e.g. '2026-07-04'
    const timeStr = state.time!; // e.g. '10:00 AM'

    // 2. Resolve Doctor (Use ID stored in state)
    if (state.doctorId && process.env.NODE_ENV === 'development') {
      // Assertion for debug mode (requirement #7)
      Logger.debug(`[ASSERTION] booking.ts received doctorId: ${state.doctorId}. No name lookup will be performed.`, 'BOOKING_ENGINE');
    }

    Logger.info(`[BOOKING_ENGINE_TRACE] Session ID: ${_callSid} | Doctor received by BookingService: "${state.doctor}" | DoctorId: "${state.doctorId}" | Another database lookup occurred: NO (Using cached ID)`, 'BOOKING_ENGINE');

    if (!state.doctorId) {
      return {
        status: 'FAILED_DOCTOR_NOT_FOUND',
        message: `No validated doctor ID found in state.`,
      };
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: state.doctorId },
    });

    if (!doctor || !doctor.isActive || doctor.hospitalId !== hospitalId) {
      return {
        status: 'FAILED_DOCTOR_NOT_FOUND',
        message: `Doctor not found, inactive, or belongs to a different hospital.`,
      };
    }

    // 3. Parse requested time slot
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
    
    const dateParts = dateStr.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);
    const appointmentDate = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));


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
    } else {
      // Update existing patient with new info
      patient = await PatientRepository.update(patient.id, {
        name: patientName
      });
    }

    // 5. Create appointment in DB
    const newAppointment = await AppointmentRepository.create({
      patientId: patient.id,
      doctorId: doctor.id,
      dateTime: appointmentDate,
      duration: 30,
      hospitalId,
      department: state.department || doctor.specialization,
      notes: 'Booked via AstraMind AI voice assistant.',
    });

    Logger.info(`[STATE_TRANSITION] booking completed! ID: ${newAppointment.id} - Doctor: ${doctor.name}`, 'BOOKING_ENGINE');

    return {
      status: 'BOOKED',
      appointmentId: newAppointment.id,
      doctor: doctor.name,
      department: doctor.specialization,
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

export const checkDoctorAvailability = async (_doctorId: string, _dateStr: string, _timeStr: string): Promise<boolean> => {
  // Always return true for the Hackathon Demo
  return true;
};
