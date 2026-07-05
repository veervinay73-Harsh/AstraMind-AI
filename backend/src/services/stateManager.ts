import { Groq } from 'groq-sdk';
import { Logger } from '../utils/logger';
import prisma from '../config/prisma';

let groqInstance: Groq | null = null;

const getGroqClient = (): Groq => {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not defined in environment variables.');
    }
    groqInstance = new Groq({ apiKey });
  }
  return groqInstance;
};

export interface BookingState {
  intent: 'BOOK_APPOINTMENT' | 'CANCEL_APPOINTMENT' | 'RESCHEDULE_APPOINTMENT' | 'ASK_HOSPITAL_INFORMATION' | 'TALK_TO_HUMAN' | 'UNKNOWN';
  state: 'COLLECTING_INFORMATION' | 'CONFIRMATION_REQUIRED' | 'CONFIRMED' | 'OTHER';
  patient_name?: string | null;
  doctor?: string | null;
  date?: string | null;
  time?: string | null;
  phone?: string | null;
  missing_fields: string[];
  invalid_doctor?: string | null;
  recommended_doctors?: { name: string; specialization: string }[] | null;
}

// In-memory conversation state store keyed by CallSid
const stateStore: Record<string, BookingState> = {};

export const getSessionState = (callSid: string): BookingState => {
  if (!stateStore[callSid]) {
    stateStore[callSid] = {
      intent: 'UNKNOWN',
      state: 'OTHER',
      patient_name: null,
      doctor: null,
      date: null,
      time: null,
      phone: null,
      missing_fields: [],
      invalid_doctor: null,
      recommended_doctors: null,
    };
  }
  return stateStore[callSid];
};

export const clearSessionState = (callSid: string): void => {
  delete stateStore[callSid];
};

export const processConversationTurn = async (
  callSid: string,
  userUtterance: string,
  callerPhone?: string
): Promise<BookingState> => {
  try {
    const groq = getGroqClient();
    const currentState = getSessionState(callSid);

    // Auto-fill phone from caller number if available and not yet set (only if it starts with '+' to represent a real phone number)
    if (callerPhone && !currentState.phone && callerPhone.startsWith('+')) {
      currentState.phone = callerPhone;
    }

    const systemPrompt = `You are a real-time hospital receptionist conversation state manager.
Your task is to analyze the conversation turn, classify the intent, and update the booking details state.

We support the following intents:
- BOOK_APPOINTMENT: Customer wants to book a new appointment.
- CANCEL_APPOINTMENT: Customer wants to cancel an existing appointment.
- RESCHEDULE_APPOINTMENT: Customer wants to reschedule or change an existing appointment.
- ASK_HOSPITAL_INFORMATION: Customer is asking general questions about the hospital (timings, insurance, parking, etc.).
- TALK_TO_HUMAN: Customer wants to speak with a human or receptionist.
- UNKNOWN: None of the above.

We track the following slot fields:
1. patient_name: Name of the patient (e.g., "John Doe", "Mary").
2. doctor: Doctor name or medical specialty/department (e.g., "Dr. Smith", "Cardiologist", "Dermatologist").
3. date: Date of the appointment. Always format this as YYYY-MM-DD. (Assume current year is 2026. For example: "tomorrow" becomes "2026-07-04" if today is July 3rd, "July 4th" becomes "2026-07-04", and "July 5th" becomes "2026-07-05").
4. time: Time of the appointment (e.g., "2:00 PM", "10:30 AM").
5. phone: Phone number of the caller.

Current session details:
${JSON.stringify(currentState, null, 2)}

User utterance: "${userUtterance}"

Rules for updates:
- Correctly classify the "intent" based on the user's latest request.
- Retain existing values for slots unless the user explicitly updates or changes them in their new utterance.
- Extract new values for slots if mentioned in the utterance.
- Always convert conversational dates into YYYY-MM-DD format.
- Always convert and normalize natural-language time expressions into standard "HH:MM AM/PM" format (e.g., "5 PM" becomes "5:00 PM", "five in the evening" becomes "5:00 PM", "half past 3" becomes "3:30 PM", "10 AM" becomes "10:00 AM", "around 5 o'clock" becomes "5:00 PM").
- Set the "state" to "COLLECTING_INFORMATION" if any of the following required slots are missing for booking: ["patient_name", "phone", "doctor", "date", "time"].
- Set the "state" to "CONFIRMATION_REQUIRED" if all of ["patient_name", "phone", "doctor", "date", "time"] are present, but the user hasn't explicitly confirmed yet.
- Set the "state" to "CONFIRMED" if all slots are present and the user explicitly agrees/confirms (e.g., "yes", "confirm", "that sounds good", "perfect").
- List any missing fields from ["patient_name", "phone", "doctor", "date", "time"] in the "missing_fields" array. The order in this array MUST reflect the exact missing fields in this priority order: patient_name, phone, doctor, date, time.

You must respond with a raw JSON object containing the updated state:
{
  "intent": "BOOK_APPOINTMENT" | "CANCEL_APPOINTMENT" | "RESCHEDULE_APPOINTMENT" | "ASK_HOSPITAL_INFORMATION" | "TALK_TO_HUMAN" | "UNKNOWN",
  "state": "COLLECTING_INFORMATION" | "CONFIRMATION_REQUIRED" | "CONFIRMED" | "OTHER",
  "patient_name": "value" or null,
  "doctor": "value" or null,
  "date": "value" or null,
  "time": "value" or null,
  "phone": "value" or null,
  "missing_fields": ["field1", "field2"]
}`;

    const response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userUtterance },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Received empty content from Groq state manager.');
    }

    const parsed = JSON.parse(content) as BookingState;
    
    // Log the extracted slots before updating the appointment state
    Logger.info(`StateManager extracted raw slots from Groq turn -> Patient Name: "${parsed.patient_name}", Phone: "${parsed.phone}", Doctor: "${parsed.doctor}", Date: "${parsed.date}", Time: "${parsed.time}"`, 'STATE_MANAGER');
    
    // Helper to sanitize "null" or "undefined" strings from LLM output
    const sanitizeSlot = (val: any): string | null => {
      if (val === null || val === undefined) return null;
      const s = String(val).trim();
      if (s === 'null' || s === 'undefined' || s === '') return null;
      return s;
    };

    const parsedDoctor = sanitizeSlot(parsed.doctor);
    const parsedPatientName = sanitizeSlot(parsed.patient_name);
    const parsedPhone = sanitizeSlot(parsed.phone);
    const parsedDate = sanitizeSlot(parsed.date);
    const parsedTime = sanitizeSlot(parsed.time);

    // Validate doctor if extracted in the current turn
    let doctorVal = parsedDoctor;
    let invalidDoc: string | null = null;
    let recDocs: { name: string; specialization: string }[] | null = null;

    if (doctorVal) {
      // Find if an active doctor exists matching name or specialization
      const activeDoctorsByName = await prisma.doctor.findMany({
        where: {
          name: { contains: doctorVal, mode: 'insensitive' },
          isActive: true,
        },
      });

      const activeDoctorsBySpec = await prisma.doctor.findMany({
        where: {
          specialization: { contains: doctorVal, mode: 'insensitive' },
          isActive: true,
        },
      });

      if (activeDoctorsByName.length > 0) {
        doctorVal = activeDoctorsByName[0].name;
        invalidDoc = null;
        recDocs = null;
      } else if (activeDoctorsBySpec.length > 0) {
        doctorVal = null;
        invalidDoc = null;
        recDocs = activeDoctorsBySpec.map(doc => ({
          name: doc.name,
          specialization: doc.specialization
        }));
      } else {
        invalidDoc = doctorVal;
        doctorVal = null;

        const fallbacks = await prisma.doctor.findMany({
          where: { isActive: true },
          take: 5,
        });
        recDocs = fallbacks.map(doc => ({
          name: doc.name,
          specialization: doc.specialization
        }));
      }
    } else {
      invalidDoc = currentState.invalid_doctor || null;
      recDocs = currentState.recommended_doctors || null;
      doctorVal = currentState.doctor || null;
    }

    const finalPhone = parsedPhone || currentState.phone || null;
    const finalPatientName = parsedPatientName || currentState.patient_name || null;
    const finalDate = parsedDate || currentState.date || null;
    const finalTime = parsedTime || currentState.time || null;

    const order = ['patient_name', 'phone', 'doctor', 'date', 'time'];
    const missingFields = order.filter(f => {
      if (f === 'patient_name') return !finalPatientName;
      if (f === 'phone') return !finalPhone;
      if (f === 'doctor') return !doctorVal;
      if (f === 'date') return !finalDate;
      if (f === 'time') return !finalTime;
      return false;
    });

    let finalState = parsed.state || 'OTHER';
    if (missingFields.length > 0) {
      finalState = 'COLLECTING_INFORMATION';
    }

    // Update the in-memory store
    stateStore[callSid] = {
      intent: parsed.intent || 'UNKNOWN',
      state: finalState as any,
      patient_name: finalPatientName,
      doctor: doctorVal,
      date: finalDate,
      time: finalTime,
      phone: finalPhone,
      missing_fields: missingFields,
      invalid_doctor: invalidDoc,
      recommended_doctors: recDocs,
    };

    return stateStore[callSid];
  } catch (error) {
    Logger.error('Failed to process conversation state turn via Groq', error, 'STATE_MANAGER');
    return getSessionState(callSid);
  }
};
