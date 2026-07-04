import { DoctorRepository } from '../repositories/doctor.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { Logger } from '../utils/logger';
import prisma from '../config/prisma';

export interface DoctorAvailability {
  doctorId: string;
  doctorName: string;
  specialization: string;
  date: string;
  availableSlots: string[];
}

export const getDoctorAvailability = async (
  specializationOrName: string,
  dateStr: string // expected format: 'YYYY-MM-DD'
): Promise<DoctorAvailability[]> => {
  try {
    // 1. Query doctors by specialization first
    let doctors = await DoctorRepository.findBySpecialization(specializationOrName);
    
    // Fallback: Query by name if no specialization match
    if (doctors.length === 0) {
      doctors = await prisma.doctor.findMany({
        where: {
          name: { contains: specializationOrName, mode: 'insensitive' },
          isActive: true,
        },
      });
    }

    if (doctors.length === 0) {
      Logger.info(`No active doctors found matching query: "${specializationOrName}"`, 'AVAILABILITY_ENGINE');
      return [];
    }

    // Parse the target date
    const dateParts = dateStr.split('-');
    if (dateParts.length !== 3) {
      throw new Error(`Invalid date format, expected YYYY-MM-DD: ${dateStr}`);
    }
    
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
    const day = parseInt(dateParts[2], 10);

    const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

    const results: DoctorAvailability[] = [];

    for (const doc of doctors) {
      // 2. Retrieve booked appointments for this doctor on the target date
      const appointments = await AppointmentRepository.findByDoctorAndDate(doc.id, startOfDay, endOfDay);
      
      // 3. Generate daily working slots (9:00 AM to 5:00 PM, every 30 mins)
      const possibleSlots: Date[] = [];
      for (let hour = 9; hour < 17; hour++) {
        for (const minute of [0, 30]) {
          const slot = new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
          possibleSlots.push(slot);
        }
      }

      // 4. Filter out slots that conflict with existing appointments
      const availableSlots = possibleSlots.filter((slot) => {
        const slotTime = slot.getTime();
        
        return !appointments.some((appt) => {
          const apptTime = appt.dateTime.getTime();
          // Default duration to 30 mins if not set
          const apptDurationMs = (appt.duration || 30) * 60 * 1000;
          return slotTime >= apptTime && slotTime < apptTime + apptDurationMs;
        });
      });

      results.push({
        doctorId: doc.id,
        doctorName: doc.name,
        specialization: doc.specialization,
        date: dateStr,
        availableSlots: availableSlots.map((slot) => slot.toISOString().substring(0, 19)),
      });
    }

    return results;
  } catch (error) {
    Logger.error(`Error calculating doctor availability for "${specializationOrName}" on ${dateStr}`, error, 'AVAILABILITY_ENGINE');
    return [];
  }
};
