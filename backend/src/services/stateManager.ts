import { Groq } from 'groq-sdk';
import { Logger } from '../utils/logger';

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

    // Auto-fill phone from caller number if available and not yet set
    if (callerPhone && !currentState.phone) {
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
- Set the "state" to "COLLECTING_INFORMATION" if any of the following required slots are missing for booking: ["doctor", "date", "time", "patient_name"].
- Set the "state" to "CONFIRMATION_REQUIRED" if all of ["doctor", "date", "time", "patient_name"] are present, but the user hasn't explicitly confirmed yet.
- Set the "state" to "CONFIRMED" if all slots are present and the user explicitly agrees/confirms (e.g., "yes", "confirm", "that sounds good", "perfect").
- List any missing fields from ["doctor", "date", "time", "patient_name"] in the "missing_fields" array.

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
      model: 'llama-3.3-70b-versatile',
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
    
    // Update the in-memory store
    stateStore[callSid] = {
      intent: parsed.intent || 'UNKNOWN',
      state: parsed.state || 'OTHER',
      patient_name: parsed.patient_name || null,
      doctor: parsed.doctor || null,
      date: parsed.date || null,
      time: parsed.time || null,
      phone: parsed.phone || currentState.phone || null,
      missing_fields: parsed.missing_fields || [],
    };

    return stateStore[callSid];
  } catch (error) {
    Logger.error('Failed to process conversation state turn via Groq', error, 'STATE_MANAGER');
    return getSessionState(callSid);
  }
};
