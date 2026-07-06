import { Logger } from '../utils/logger';
import { getGroqClient } from '../config/groq';
import prisma from '../config/prisma';

export interface BookingState {
  intent: 'BOOK_APPOINTMENT' | 'CANCEL_APPOINTMENT' | 'RESCHEDULE_APPOINTMENT' | 'ASK_HOSPITAL_INFORMATION' | 'TALK_TO_HUMAN' | 'UNKNOWN';
  state: 'COLLECTING_INFORMATION' | 'CONFIRMATION_REQUIRED' | 'CONFIRMED' | 'OTHER';
  patient_name?: string | null;
  phone?: string | null;
  department?: string | null;
  doctor?: string | null;
  doctorId?: string | null;
  date?: string | null;
  time?: string | null;
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
      state: 'COLLECTING_INFORMATION',
      patient_name: null,
      phone: null,
      department: null,
      doctor: null,
      doctorId: null,
      date: null,
      time: null,
      missing_fields: ['patient_name', 'phone', 'department', 'date', 'time'],
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

    if (callerPhone && !currentState.phone && callerPhone.startsWith('+')) {
      currentState.phone = callerPhone;
    }

    // DETERMINISTIC LLM BYPASS FOR CONFIRMATION
    if (currentState.state === 'CONFIRMATION_REQUIRED') {
      const affirmRegex = /^(yes|yeah|yep|confirm|correct|sure|ok|okay|book it|yes please|proceed|go ahead|please confirm)/i;
      const cancelRegex = /^(no|cancel|stop|actually no|nevermind|never mind|don't book)/i;
      const trimmed = userUtterance.trim();

      if (affirmRegex.test(trimmed)) {
        currentState.intent = 'BOOK_APPOINTMENT';
        currentState.state = 'CONFIRMED';
        Logger.info(`[STATE_TRANSITION] LLM Bypassed - Explicit Confirmation Detected`, 'STATE_MANAGER');
        return currentState;
      } else if (cancelRegex.test(trimmed)) {
        currentState.intent = 'CANCEL_APPOINTMENT';
        currentState.state = 'OTHER';
        Logger.info(`[STATE_TRANSITION] LLM Bypassed - Explicit Cancellation Detected`, 'STATE_MANAGER');
        return currentState;
      }
    }

    const systemPrompt = `You are a natural language understanding engine for a hospital receptionist.
Your ONLY task is to extract information from the user's utterance and output it in a strict JSON format.

Intents:
- CONFIRMATION_YES: The user is confirming their appointment details (e.g. "Yes", "Confirm", "Looks good", "Yes please", "Book it").
- CONFIRMATION_NO: The user is declining or cancelling their appointment (e.g. "No", "Cancel it", "Actually no").
- BOOK_APPOINTMENT: The user wants to book a new appointment or is providing booking details.
- RESCHEDULE_APPOINTMENT: The user wants to reschedule.
- ASK_HOSPITAL_INFORMATION: The user is asking general questions.
- TALK_TO_HUMAN: The user wants to speak with a human.
- UNKNOWN: None of the above.

Slots to extract:
1. patientName: The patient's name.
2. phone: The caller's phone number.
3. department: The hospital department or specialization.
4. doctor: The preferred doctor's name.
5. date: The appointment date (convert to YYYY-MM-DD. Assume today is ${new Date().toISOString().slice(0, 10)}).
6. time: The appointment time (convert to "HH:MM AM/PM").

Rules:
- ONLY output new values provided by the user in this specific utterance.
- If the user has not explicitly provided a slot in THIS utterance, output null.
- Do NOT output placeholder strings like "unknown", "not specified", "none". Output null instead.

Current session context (for coreference resolution only):
${JSON.stringify(currentState, null, 2)}

User utterance: "${userUtterance}"

Output ONLY valid JSON:
{
  "intent": "CONFIRMATION_YES" | "CONFIRMATION_NO" | "BOOK_APPOINTMENT" | "RESCHEDULE_APPOINTMENT" | "ASK_HOSPITAL_INFORMATION" | "TALK_TO_HUMAN" | "UNKNOWN",
  "patientName": string | null,
  "phone": string | null,
  "department": string | null,
  "doctor": string | null,
  "date": string | null,
  "time": string | null
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

    const parsed = JSON.parse(content);
    
    // Helper to sanitize "null" or "undefined" or placeholder strings from LLM output
    const sanitizeSlot = (slotName: string, val: any): string | null => {
      if (val === null || val === undefined) return null;
      const s = String(val).trim();
      const lower = s.toLowerCase();
      if (['null', 'undefined', '', 'not specified', 'unknown', 'n/a', 'none', 'unspecified'].includes(lower)) {
        Logger.info(`[STATE_TRANSITION] Slot rejected (placeholder): ${slotName} = "${s}"`, 'STATE_MANAGER');
        return null;
      }
      return s;
    };

    const parsedDoctor = sanitizeSlot('doctor', parsed.doctor);
    const parsedPatientName = sanitizeSlot('patientName', parsed.patientName);
    const parsedPhone = sanitizeSlot('phone', parsed.phone);
    const parsedDate = sanitizeSlot('date', parsed.date);
    const parsedTime = sanitizeSlot('time', parsed.time);
    const parsedDepartment = sanitizeSlot('department', parsed.department);

    const checkUpdate = (slotName: string, parsedVal: string | null, currentVal: string | null) => {
      if (parsedVal && parsedVal !== currentVal) {
        if (currentVal) Logger.info(`[STATE_TRANSITION] Slot updated: ${slotName} changed from "${currentVal}" to "${parsedVal}"`, 'STATE_MANAGER');
        else Logger.info(`[STATE_TRANSITION] Slot collected: ${slotName} = "${parsedVal}"`, 'STATE_MANAGER');
      } else if (parsedVal && parsedVal === currentVal) {
        Logger.info(`[STATE_TRANSITION] Slot ignored (no change or redundant): ${slotName} = "${parsedVal}"`, 'STATE_MANAGER');
      }
    };

    checkUpdate('patientName', parsedPatientName, currentState.patient_name || null);
    checkUpdate('phone', parsedPhone, currentState.phone || null);
    checkUpdate('doctor', parsedDoctor, currentState.doctor || null);
    checkUpdate('department', parsedDepartment, currentState.department || null);
    checkUpdate('date', parsedDate, currentState.date || null);
    checkUpdate('time', parsedTime, currentState.time || null);

    // Apply extracted slots to state (prioritize keeping existing unless LLM explicitly extracted a new valid value)
    if (parsedPatientName) currentState.patient_name = parsedPatientName;
    if (parsedPhone) currentState.phone = parsedPhone;
    if (parsedDate) currentState.date = parsedDate;
    if (parsedTime) currentState.time = parsedTime;
    if (parsedDepartment) currentState.department = parsedDepartment;

    let doctorVal = parsedDoctor || currentState.doctor;
    let invalidDoc: string | null = null;
    let recDocs: { name: string; specialization: string }[] | null = null;

    if (parsedDoctor || parsedDepartment) {
      // Re-resolve doctor logic
      // Normalize to remove "Doctor " or "Dr. "
      let searchName = (parsedDoctor || parsedDepartment || "").replace(/^(doctor|dr\.?)\s+/i, '').trim();

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
      } else if (parsedDoctor) {
        // Only if they specifically asked for a doctor name that was invalid
        invalidDoc = parsedDoctor;
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
       // Keep existing invalid_doc or rec_docs if neither doctor nor department was updated
       invalidDoc = currentState.invalid_doctor || null;
       recDocs = currentState.recommended_doctors || null;
    }

    currentState.doctor = doctorVal;
    currentState.invalid_doctor = invalidDoc;
    currentState.recommended_doctors = recDocs;

    // Intent resolution
    let finalIntent = currentState.intent;
    if (parsed.intent === 'CONFIRMATION_YES') {
      finalIntent = 'BOOK_APPOINTMENT';
    } else if (parsed.intent === 'CONFIRMATION_NO') {
      finalIntent = 'CANCEL_APPOINTMENT';
    } else if (parsed.intent && parsed.intent !== 'UNKNOWN') {
      finalIntent = parsed.intent;
    }
    currentState.intent = finalIntent as any;

    // Hardcode fallback affirmation check
    const affirmRegex = /^(yes|yeah|yep|confirm|correct|sure|ok|okay|book it|yes please)/i;
    const cancelRegex = /^(no|cancel|stop|actually no|nevermind|never mind|don't book)/i;
    
    if (currentState.state === 'CONFIRMATION_REQUIRED') {
      if (affirmRegex.test(userUtterance.trim())) {
        parsed.intent = 'CONFIRMATION_YES';
        currentState.intent = 'BOOK_APPOINTMENT';
      } else if (cancelRegex.test(userUtterance.trim())) {
        parsed.intent = 'CONFIRMATION_NO';
        currentState.intent = 'CANCEL_APPOINTMENT';
      }
    }

    // Determine Missing Slots Deterministically
    const order = ['patient_name', 'phone', 'department', 'date', 'time'];
    const missingFields = order.filter(f => {
      if (f === 'patient_name') return !currentState.patient_name;
      if (f === 'phone') return !currentState.phone;
      if (f === 'department') return !currentState.department && !currentState.doctor;
      if (f === 'date') return !currentState.date;
      if (f === 'time') return !currentState.time;
      return false;
    });
    currentState.missing_fields = missingFields;

    // Determine Workflow State Deterministically
    let finalState = currentState.state;
    if (missingFields.length > 0) {
      finalState = 'COLLECTING_INFORMATION';
    } else {
      if (parsed.intent === 'CONFIRMATION_YES') {
        finalState = 'CONFIRMED';
      } else if (parsed.intent === 'CONFIRMATION_NO') {
        finalState = 'OTHER'; // Will trigger CANCEL_APPOINTMENT in orchestrator
      } else {
        finalState = 'CONFIRMATION_REQUIRED';
      }
    }
    
    if (finalState === 'CONFIRMATION_REQUIRED' && currentState.state !== 'CONFIRMATION_REQUIRED') {
      Logger.info(`[STATE_TRANSITION] confirmation started`, 'STATE_MANAGER');
    }

    currentState.state = finalState as any;

    Logger.info(`
Current BookingState:
{
  "patientName": ${JSON.stringify(currentState.patient_name || null)},
  "phone": ${JSON.stringify(currentState.phone || null)},
  "doctor": ${JSON.stringify(currentState.doctor || null)},
  "specialization": ${JSON.stringify(currentState.department || null)},
  "date": ${JSON.stringify(currentState.date || null)},
  "time": ${JSON.stringify(currentState.time || null)},
  "confirmationState": ${JSON.stringify(currentState.state)}
}
Current Missing Slots: ${JSON.stringify(currentState.missing_fields)}
Current Workflow State: ${currentState.state}
Next Action: ${currentState.state === 'CONFIRMED' ? 'BOOK_APPOINTMENT' : currentState.state === 'CONFIRMATION_REQUIRED' ? 'ASK_CONFIRMATION' : 'ASK_MISSING_SLOTS'}
`, 'STATE_MANAGER');

    return currentState;
  } catch (error) {
    Logger.error('Failed to process conversation state turn via Groq', error, 'STATE_MANAGER');
    return getSessionState(callSid);
  }
};
