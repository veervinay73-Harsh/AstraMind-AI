import { Logger } from '../utils/logger';
import { getGroqClient } from '../config/groq';
import prisma from '../config/prisma';

export interface BookingState {
  intent: 'BOOK_APPOINTMENT' | 'CANCEL_APPOINTMENT' | 'RESCHEDULE_APPOINTMENT' | 'ASK_HOSPITAL_INFORMATION' | 'TALK_TO_HUMAN' | 'UNKNOWN';
  state: 'COLLECTING_INFORMATION' | 'CONFIRMATION_REQUIRED' | 'CONFIRMED' | 'OTHER';
  patient_name?: string | null;
  phone?: string | null;
  age?: number | null;
  gender?: string | null;
  is_new_patient?: boolean | null;
  department?: string | null;
  doctor?: string | null;
  doctorId?: string | null;
  reason_for_visit?: string | null;
  symptoms?: string | null;
  date?: string | null;
  time?: string | null;
  insurance_details?: string | null;
  missing_fields: string[];
  invalid_doctor?: string | null;
  doctor_unavailable?: boolean;
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
      phone: null,
      age: null,
      gender: null,
      is_new_patient: null,
      department: null,
      doctor: null,
      doctorId: null,
      reason_for_visit: null,
      symptoms: null,
      date: null,
      time: null,
      insurance_details: null,
      missing_fields: [],
      invalid_doctor: null,
      doctor_unavailable: false,
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
  callerPhone?: string,
  hospitalId?: string
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
2. phone: Phone number of the caller.
3. age: Age of the patient (number).
4. gender: Gender of the patient.
5. is_new_patient: Boolean, whether they are a new or existing patient.
6. department: The hospital department (e.g., "Cardiology", "General Physician").
7. doctor: Preferred doctor name, if any (e.g., "Dr. Smith").
8. reason_for_visit: Short description of why they need an appointment.
9. symptoms: Any symptoms described, if applicable.
10. date: 
        - Natural language terms like "tomorrow", "next Monday" should be resolved to YYYY-MM-DD. Assume current date is ${new Date().toISOString().slice(0, 10)}.
        - Only output valid values. If the user hasn't provided a slot, output null for that field.
11. time: Time of the appointment (e.g., "2:00 PM", "10:30 AM").
12. insurance_details: Insurance provider or policy info, if mentioned.

Current session details:
${JSON.stringify(currentState, null, 2)}

User utterance: "${userUtterance}"

Rules for updates:
- Correctly classify the "intent" based on the user's latest request.
- Retain existing values for slots unless the user explicitly updates or changes them in their new utterance.
- Extract new values for slots if mentioned in the utterance.
- Always convert conversational dates into YYYY-MM-DD format.
- Always convert and normalize natural-language time expressions into standard "HH:MM AM/PM" format.
- Set the "state" to "COLLECTING_INFORMATION" if any of the following required slots are missing for booking: ["patient_name", "phone", "age", "gender", "is_new_patient", "department", "reason_for_visit", "date", "time"]. (doctor, symptoms, and insurance_details are optional).
- Set the "state" to "CONFIRMATION_REQUIRED" if all required slots are present, but the user hasn't explicitly confirmed yet.
- Set the "state" to "CONFIRMED" if all required slots are present and the user explicitly agrees/confirms (e.g., "yes", "confirm", "that sounds good", "perfect").
- List any missing fields from the required slots in the "missing_fields" array. The order in this array MUST reflect the exact missing fields in this priority order: patient_name, phone, age, gender, is_new_patient, department, reason_for_visit, date, time.

You must respond with a raw JSON object containing the updated state:
{
  "intent": "BOOK_APPOINTMENT" | "CANCEL_APPOINTMENT" | "RESCHEDULE_APPOINTMENT" | "ASK_HOSPITAL_INFORMATION" | "TALK_TO_HUMAN" | "UNKNOWN",
  "state": "COLLECTING_INFORMATION" | "CONFIRMATION_REQUIRED" | "CONFIRMED" | "OTHER",
  "patient_name": string | null,
  "phone": string | null,
  "age": number | null,
  "gender": string | null,
  "is_new_patient": boolean | null,
  "department": string | null,
  "doctor": string | null,
  "reason_for_visit": string | null,
  "symptoms": string | null,
  "date": string | null,
  "time": string | null,
  "insurance_details": string | null,
  "missing_fields": string[]
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
    Logger.info(`[STATE_MANAGER_TRACE] Session ID: ${callSid} | Doctor extracted by LLM: "${parsedDoctor}"`, 'STATE_MANAGER');
    const parsedPatientName = sanitizeSlot(parsed.patient_name);
    const parsedPhone = sanitizeSlot(parsed.phone);
    const parsedDate = sanitizeSlot(parsed.date);
    const parsedTime = sanitizeSlot(parsed.time);
    const parsedAge = parsed.age;
    const parsedGender = sanitizeSlot(parsed.gender);
    const parsedIsNewPatient = parsed.is_new_patient;
    const parsedDepartment = sanitizeSlot(parsed.department);
    const parsedReasonForVisit = sanitizeSlot(parsed.reason_for_visit);
    const parsedSymptoms = sanitizeSlot(parsed.symptoms);
    const parsedInsurance = sanitizeSlot(parsed.insurance_details);

    let doctorVal = parsedDoctor;
    let invalidDoc: string | null = null;
    let recDocs: { name: string; specialization: string }[] | null = null;

    if (doctorVal) {
      // Normalize to remove "Doctor " or "Dr. " for robust contains matching
      const searchName = doctorVal.replace(/^(doctor|dr\.?)\s+/i, '').trim();

      // Find if an active doctor exists matching name or specialization
      const activeDoctorsByName = await prisma.doctor.findMany({
        where: {
          name: { contains: searchName, mode: 'insensitive' },
          isActive: true,
          ...(hospitalId ? { hospitalId } : {}),
        },
      });

      const activeDoctorsBySpec = await prisma.doctor.findMany({
        where: {
          specialization: { contains: searchName, mode: 'insensitive' },
          isActive: true,
          ...(hospitalId ? { hospitalId } : {}),
        },
      });

      if (activeDoctorsByName.length > 0) {
        doctorVal = activeDoctorsByName[0].name;
        currentState.doctorId = activeDoctorsByName[0].id;
        invalidDoc = null;
        recDocs = null;
      } else if (activeDoctorsBySpec.length > 0) {
        doctorVal = null;
        currentState.doctorId = null;
        invalidDoc = null;
        recDocs = activeDoctorsBySpec.map(doc => ({
          name: doc.name,
          specialization: doc.specialization
        }));
      } else {
        invalidDoc = doctorVal;
        doctorVal = null;
        currentState.doctorId = null;

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
    const finalAge = parsedAge ?? currentState.age ?? null;
    const finalGender = parsedGender || currentState.gender || null;
    const finalIsNewPatient = parsedIsNewPatient ?? currentState.is_new_patient ?? null;
    const finalDepartment = parsedDepartment || currentState.department || null;
    const finalReasonForVisit = parsedReasonForVisit || currentState.reason_for_visit || null;
    const finalSymptoms = parsedSymptoms || currentState.symptoms || null;
    const finalInsurance = parsedInsurance || currentState.insurance_details || null;

    const order = ['patient_name', 'phone', 'age', 'gender', 'is_new_patient', 'department', 'reason_for_visit', 'date', 'time'];
    const missingFields = order.filter(f => {
      if (f === 'patient_name') return !finalPatientName;
      if (f === 'phone') return !finalPhone;
      if (f === 'age') return finalAge === null;
      if (f === 'gender') return !finalGender;
      if (f === 'is_new_patient') return finalIsNewPatient === null;
      if (f === 'department') return !finalDepartment;
      if (f === 'reason_for_visit') return !finalReasonForVisit;
      if (f === 'date') return !finalDate;
      if (f === 'time') return !finalTime;
      return false;
    });

    let finalState = parsed.state || 'OTHER';
    if (missingFields.length > 0) {
      finalState = 'COLLECTING_INFORMATION';
    }

    // Update the in-memory store
    Object.assign(currentState, {
      intent: parsed.intent || 'UNKNOWN',
      state: finalState,
      patient_name: finalPatientName,
      doctor: doctorVal,
      date: finalDate,
      time: finalTime,
      phone: finalPhone,
      age: finalAge,
      gender: finalGender,
      is_new_patient: finalIsNewPatient,
      department: finalDepartment,
      reason_for_visit: finalReasonForVisit,
      symptoms: finalSymptoms,
      insurance_details: finalInsurance,
      missing_fields: missingFields,
      invalid_doctor: invalidDoc,
      // If we are setting doctor/time from the user's explicit new statement, we reset unavailable flag,
      // assuming it will be checked again by the orchestrator.
      doctor_unavailable: parsedDate !== null || parsedTime !== null || parsedDoctor !== null ? false : currentState.doctor_unavailable,
      recommended_doctors: recDocs,
    });

    Logger.info(`Updated session state: ${JSON.stringify(currentState)}`, 'STATE_MANAGER');
    return currentState;
  } catch (error) {
    Logger.error('Failed to process conversation state turn via Groq', error, 'STATE_MANAGER');
    return getSessionState(callSid);
  }
};
