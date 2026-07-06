import { Logger } from '../utils/logger';
import { getGroqClient } from '../config/groq';
import prisma from '../config/prisma';

export interface BookingState {
  intent: 'BOOK_APPOINTMENT' | 'CANCEL_APPOINTMENT' | 'RESCHEDULE_APPOINTMENT' | 'CHANGE_DOCTOR' | 'CHANGE_DATE' | 'CHANGE_TIME' | 'APPOINTMENT_STATUS' | 'UPCOMING_APPOINTMENTS' | 'PAST_APPOINTMENTS' | 'ASK_HOSPITAL_INFORMATION' | 'TALK_TO_HUMAN' | 'UNKNOWN';
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

  // Real Receptionist Lifecycle States
  patientId?: string | null;
  patientExists?: boolean;
  activeAppointmentId?: string | null;
  operation?: 'BOOK' | 'CANCEL' | 'RESCHEDULE' | 'CHANGE_DOCTOR' | 'CHANGE_DATE' | 'CHANGE_TIME' | 'STATUS' | 'UPCOMING' | 'PAST' | null;
  lifecycleState: 'Collecting Name' | 'Collecting Phone' | 'Collecting Doctor' | 'Collecting Date' | 'Collecting Time' | 'Waiting Confirmation' | 'Booked' | 'Cancelled' | 'Rescheduled' | 'Completed' | 'Idle';
  upcomingAppointments?: any[] | null;
  cancelledAppointments?: any[] | null;
  pastAppointments?: any[] | null;
  latest_intent?: string;
  latest_entities?: any;
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
      // Default tracking states
      patientId: null,
      patientExists: false,
      activeAppointmentId: null,
      operation: null,
      lifecycleState: 'Idle',
      upcomingAppointments: null,
      cancelledAppointments: null,
      pastAppointments: null,
    };
  }
  return stateStore[callSid];
};

export const clearSessionState = (callSid: string): void => {
  delete stateStore[callSid];
};

// Helper function to fetch and load patient context
export const loadPatientContext = async (currentState: BookingState, hospitalId: string) => {
  if (currentState.phone && !currentState.patientId && hospitalId) {
    const normalizedQuery = currentState.phone.replace(/\D/g, '');
    if (normalizedQuery) {
      Logger.info(`Attempting patient identification for digits: ${normalizedQuery}`, 'STATE_MANAGER');
      const patients = await prisma.patient.findMany({
        where: { hospitalId }
      });
      const matchedPatient = patients.find(p => {
        const pDigits = p.phone.replace(/\D/g, '');
        return pDigits.endsWith(normalizedQuery) || normalizedQuery.endsWith(pDigits);
      });

      if (matchedPatient) {
        currentState.patientId = matchedPatient.id;
        currentState.patient_name = matchedPatient.name;
        currentState.patientExists = true;
        Logger.info(`Patient identified: ${matchedPatient.name} (ID: ${matchedPatient.id})`, 'STATE_MANAGER');

        // Fetch their appointment history
        const appts = await prisma.appointment.findMany({
          where: { patientId: matchedPatient.id, hospitalId },
          include: { doctor: true },
          orderBy: { dateTime: 'desc' }
        });

        const now = new Date();
        const upcoming = appts.filter(a => new Date(a.dateTime) >= now && a.status !== 'CANCELLED' && a.status !== 'COMPLETED');
        const cancelled = appts.filter(a => a.status === 'CANCELLED');
        const past = appts.filter(a => new Date(a.dateTime) < now || a.status === 'COMPLETED');

        currentState.upcomingAppointments = upcoming.map(a => ({
          id: a.id,
          doctorName: a.doctor.name,
          specialization: a.doctor.specialization,
          dateTime: a.dateTime.toISOString(),
          status: a.status
        }));
        currentState.cancelledAppointments = cancelled.map(a => ({
          id: a.id,
          doctorName: a.doctor.name,
          specialization: a.doctor.specialization,
          dateTime: a.dateTime.toISOString(),
          status: a.status
        }));
        currentState.pastAppointments = past.map(a => ({
          id: a.id,
          doctorName: a.doctor.name,
          specialization: a.doctor.specialization,
          dateTime: a.dateTime.toISOString(),
          status: a.status
        }));

        // Set active upcoming appointment if available
        if (upcoming.length > 0) {
          const sortedUpcoming = [...upcoming].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
          currentState.activeAppointmentId = sortedUpcoming[0].id;
          Logger.info(`Active upcoming appointment ID resolved: ${currentState.activeAppointmentId}`, 'STATE_MANAGER');
        }
      } else {
        Logger.info('No matching patient profile found for this caller.', 'STATE_MANAGER');
      }
    }
  }
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

    if (callerPhone && !currentState.phone) {
      // Clean leading country codes or formatting
      currentState.phone = callerPhone;
    }

    // Auto-identify patient if not already done
    if (hospitalId) {
      await loadPatientContext(currentState, hospitalId);
    }

    // DETERMINISTIC LLM BYPASS FOR CONFIRMATION
    if (currentState.state === 'CONFIRMATION_REQUIRED') {
      const affirmRegex = /^(yes|yeah|yep|confirm|correct|sure|ok|okay|book it|yes please|proceed|go ahead|please confirm)/i;
      const cancelRegex = /^(no|cancel|stop|actually no|nevermind|never mind|don't book)/i;
      const trimmed = userUtterance.trim();

      if (affirmRegex.test(trimmed)) {
        currentState.state = 'CONFIRMED';
        Logger.info(`[STATE_TRANSITION] LLM Bypassed - Explicit Confirmation Detected`, 'STATE_MANAGER');
        
        // Update lifecycle state immediately for display
        if (currentState.operation === 'BOOK') currentState.lifecycleState = 'Booked';
        else if (currentState.operation === 'CANCEL') currentState.lifecycleState = 'Cancelled';
        else if (['RESCHEDULE', 'CHANGE_DOCTOR', 'CHANGE_DATE', 'CHANGE_TIME'].includes(currentState.operation || '')) {
          currentState.lifecycleState = 'Rescheduled';
        }
        return currentState;
      } else if (cancelRegex.test(trimmed)) {
        currentState.state = 'OTHER';
        Logger.info(`[STATE_TRANSITION] LLM Bypassed - Explicit Cancellation Detected`, 'STATE_MANAGER');
        return currentState;
      }
    }

    const systemPrompt = `You are a natural language understanding engine for a hospital receptionist.
Your ONLY task is to extract information from the user's utterance and output it in a strict JSON format.

Intents:
- BOOK_APPOINTMENT: The user wants to book a new appointment or is providing booking details.
- CANCEL_APPOINTMENT: The user explicitly wants to cancel an appointment (e.g. "Cancel my appointment").
- RESCHEDULE_APPOINTMENT: The user explicitly wants to reschedule an appointment (e.g. "Reschedule my appointment").
- CHANGE_DOCTOR: The user wants a different doctor or to change their doctor (e.g. "I want another doctor", "Change my doctor").
- CHANGE_DATE: The user wants to change ONLY the date of their appointment (e.g. "Change the date of my appointment"). Do NOT use RESCHEDULE_APPOINTMENT for this.
- CHANGE_TIME: The user wants to change ONLY the time of their appointment (e.g. "Change the time of my appointment"). Do NOT use RESCHEDULE_APPOINTMENT for this.
- APPOINTMENT_STATUS: The user is asking about the status of their appointment (e.g. "What is my appointment status?").
- UPCOMING_APPOINTMENTS: The user wants to know about their upcoming appointments.
- PAST_APPOINTMENTS: The user wants to hear about their past appointments.
- CONFIRMATION_YES: The user is confirming details (e.g. "Yes", "Confirm", "Yes please").
- CONFIRMATION_NO: The user is declining or cancelling their request (e.g. "No", "Don't confirm").
- ASK_HOSPITAL_INFORMATION: The user is asking general questions about the hospital.
- TALK_TO_HUMAN: The user wants to speak with a human.
- UNKNOWN: None of the above.

Slots to extract:
1. patientName: The patient's name.
2. phone: The caller's phone number.
3. department: The hospital department or specialization (e.g. "Cardiology").
4. doctor: The preferred doctor's name (e.g. "Dr. Robert Smith").
5. date: The appointment date (convert to YYYY-MM-DD. Assume today is ${new Date().toISOString().slice(0, 10)}).
6. time: The appointment time (convert to "HH:MM AM/PM", e.g., "02:00 PM").

Rules:
- ONLY output new values provided by the user in this specific utterance.
- If the user has not explicitly provided a slot in THIS utterance, output null.
- Do NOT output placeholder strings like "unknown", "not specified", "none", "null", "undefined". Output null instead.

Current session context (for coreference resolution only):
${JSON.stringify(currentState, null, 2)}

User utterance: "${userUtterance}"

Output ONLY valid JSON:
{
  "intent": "BOOK_APPOINTMENT" | "CANCEL_APPOINTMENT" | "RESCHEDULE_APPOINTMENT" | "CHANGE_DOCTOR" | "CHANGE_DATE" | "CHANGE_TIME" | "APPOINTMENT_STATUS" | "UPCOMING_APPOINTMENTS" | "PAST_APPOINTMENTS" | "CONFIRMATION_YES" | "CONFIRMATION_NO" | "ASK_HOSPITAL_INFORMATION" | "TALK_TO_HUMAN" | "UNKNOWN",
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

    // Sanitize slot outputs
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

    let parsedDoctor = sanitizeSlot('doctor', parsed.doctor);
    let parsedPatientName = sanitizeSlot('patientName', parsed.patientName);
    const parsedPhone = sanitizeSlot('phone', parsed.phone);
    const parsedDate = sanitizeSlot('date', parsed.date);
    const parsedTime = sanitizeSlot('time', parsed.time);
    const parsedDepartment = sanitizeSlot('department', parsed.department);

    // Prevent overwriting existing patient name, and handle LLM confusing doctor name as patient name
    if (currentState.operation === 'CHANGE_DOCTOR' && !parsedDoctor && parsedPatientName) {
      parsedDoctor = parsedPatientName;
      parsedPatientName = null;
    } else if (currentState.patientExists && parsedPatientName) {
      parsedPatientName = null;
    }

    currentState.latest_intent = parsed.intent || 'UNKNOWN';
    currentState.latest_entities = {
      patientName: parsedPatientName,
      phone: parsedPhone,
      doctor: parsedDoctor,
      department: parsedDepartment,
      date: parsedDate,
      time: parsedTime
    };

    // Apply operation context if intent changed
    const incomingIntent = parsed.intent;
    if (incomingIntent && incomingIntent !== 'UNKNOWN' && incomingIntent !== 'CONFIRMATION_YES' && incomingIntent !== 'CONFIRMATION_NO') {
      const intentToOperationMap: Record<string, string> = {
        BOOK_APPOINTMENT: 'BOOK',
        CANCEL_APPOINTMENT: 'CANCEL',
        RESCHEDULE_APPOINTMENT: 'RESCHEDULE',
        CHANGE_DOCTOR: 'CHANGE_DOCTOR',
        CHANGE_DATE: 'CHANGE_DATE',
        CHANGE_TIME: 'CHANGE_TIME',
        APPOINTMENT_STATUS: 'STATUS',
        UPCOMING_APPOINTMENTS: 'UPCOMING',
        PAST_APPOINTMENTS: 'PAST'
      };
      
      let newOp = intentToOperationMap[incomingIntent];
      if (newOp) {
        // Force booking/modification intents to BOOK if no active appointment exists to change
        if (!currentState.activeAppointmentId && ['CANCEL', 'RESCHEDULE', 'CHANGE_DOCTOR', 'CHANGE_DATE', 'CHANGE_TIME'].includes(newOp)) {
          newOp = 'BOOK';
        }

        const isSlotFilling = ['BOOK', 'CHANGE_DATE', 'CHANGE_TIME'].includes(newOp);
        const hasSpecificOp = ['RESCHEDULE', 'CANCEL', 'CHANGE_DOCTOR', 'CHANGE_DATE', 'CHANGE_TIME'].includes(currentState.operation || '');
        
        if (hasSpecificOp && isSlotFilling) {
          if (currentState.operation === 'RESCHEDULE') {
            newOp = 'RESCHEDULE';
          } else {
            newOp = currentState.operation!;
          }
        }
      }

      if (newOp && newOp !== currentState.operation) {
        Logger.info(`[STATE_TRANSITION] Operation changed to ${newOp}`, 'STATE_MANAGER');
        currentState.operation = newOp as any;

        // Reset state parameters depending on the specific modification request
        if (newOp === 'RESCHEDULE') {
          currentState.date = null;
          currentState.time = null;
        } else if (newOp === 'CHANGE_DOCTOR') {
          currentState.doctor = null;
          currentState.doctorId = null;
        } else if (newOp === 'CHANGE_DATE') {
          currentState.date = null;
        } else if (newOp === 'CHANGE_TIME') {
          currentState.time = null;
        }
      }
    }

    // Default to BOOK if patient identifies slot filling without an active operation
    if (!currentState.operation && (parsedPatientName || parsedPhone || parsedDoctor || parsedDepartment || parsedDate || parsedTime)) {
      currentState.operation = 'BOOK';
    }

    // Slots verification and updates
    const checkUpdate = (slotName: string, parsedVal: string | null, currentVal: string | null) => {
      if (parsedVal && parsedVal !== currentVal) {
        if (currentVal) Logger.info(`[STATE_TRANSITION] Slot updated: ${slotName} changed from "${currentVal}" to "${parsedVal}"`, 'STATE_MANAGER');
        else Logger.info(`[STATE_TRANSITION] Slot collected: ${slotName} = "${parsedVal}"`, 'STATE_MANAGER');
      }
    };

    checkUpdate('patientName', parsedPatientName, currentState.patient_name || null);
    checkUpdate('phone', parsedPhone, currentState.phone || null);
    checkUpdate('doctor', parsedDoctor, currentState.doctor || null);
    checkUpdate('department', parsedDepartment, currentState.department || null);
    checkUpdate('date', parsedDate, currentState.date || null);
    checkUpdate('time', parsedTime, currentState.time || null);

    if (parsedPatientName) currentState.patient_name = parsedPatientName;
    if (parsedPhone) currentState.phone = parsedPhone;
    if (parsedDate) currentState.date = parsedDate;
    if (parsedTime) currentState.time = parsedTime;
    if (parsedDepartment) currentState.department = parsedDepartment;

    // Doctor Resolution
    let doctorVal = parsedDoctor || currentState.doctor;
    let invalidDoc: string | null = null;
    let recDocs: { name: string; specialization: string }[] | null = null;

    if (parsedDoctor || parsedDepartment) {
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
        invalidDoc = parsedDoctor;
        doctorVal = null;
        currentState.doctorId = null;
        const fallbacks = await prisma.doctor.findMany({
          where: { isActive: true, ...(hospitalId ? { hospitalId } : {}) },
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
    }

    currentState.doctor = doctorVal;
    currentState.invalid_doctor = invalidDoc;
    currentState.recommended_doctors = recDocs;

    // Determine missing slots deterministically based on operation type
    let order: string[] = [];
    if (currentState.operation === 'BOOK') {
      order = ['patient_name', 'phone', 'department', 'date', 'time'];
    } else if (currentState.operation === 'RESCHEDULE') {
      order = ['date', 'time'];
    } else if (currentState.operation === 'CHANGE_DOCTOR') {
      order = ['department']; // doctor is department
    } else if (currentState.operation === 'CHANGE_DATE') {
      order = ['date'];
    } else if (currentState.operation === 'CHANGE_TIME') {
      order = ['time'];
    }

    const missingFields = order.filter(f => {
      if (f === 'patient_name') return !currentState.patient_name;
      if (f === 'phone') return !currentState.phone;
      if (f === 'department') return !currentState.department && !currentState.doctor;
      if (f === 'date') return !currentState.date;
      if (f === 'time') return !currentState.time;
      return false;
    });
    currentState.missing_fields = missingFields;

    // Workflow state progression
    let finalState = currentState.state;
    if (missingFields.length > 0) {
      finalState = 'COLLECTING_INFORMATION';
    } else {
      if (parsed.intent === 'CONFIRMATION_YES') {
        finalState = 'CONFIRMED';
      } else if (parsed.intent === 'CONFIRMATION_NO') {
        finalState = 'OTHER';
      } else {
        // All fields filled, ready to prompt for confirmation
        finalState = 'CONFIRMATION_REQUIRED';
      }
    }

    currentState.state = finalState as any;

    // Derive the exact lifecycle state
    let lifecycle: typeof currentState.lifecycleState = 'Idle';
    if (currentState.state === 'CONFIRMED') {
      if (currentState.operation === 'BOOK') lifecycle = 'Booked';
      else if (currentState.operation === 'CANCEL') lifecycle = 'Cancelled';
      else lifecycle = 'Rescheduled';
    } else if (currentState.state === 'CONFIRMATION_REQUIRED') {
      lifecycle = 'Waiting Confirmation';
    } else if (currentState.state === 'COLLECTING_INFORMATION') {
      if (missingFields[0] === 'patient_name') lifecycle = 'Collecting Name';
      else if (missingFields[0] === 'phone') lifecycle = 'Collecting Phone';
      else if (missingFields[0] === 'department') lifecycle = 'Collecting Doctor';
      else if (missingFields[0] === 'date') lifecycle = 'Collecting Date';
      else if (missingFields[0] === 'time') lifecycle = 'Collecting Time';
    }
    currentState.lifecycleState = lifecycle;

    Logger.info(`
Current BookingState:
{
  "patientName": ${JSON.stringify(currentState.patient_name || null)},
  "phone": ${JSON.stringify(currentState.phone || null)},
  "doctor": ${JSON.stringify(currentState.doctor || null)},
  "specialization": ${JSON.stringify(currentState.department || null)},
  "date": ${JSON.stringify(currentState.date || null)},
  "time": ${JSON.stringify(currentState.time || null)},
  "operation": ${JSON.stringify(currentState.operation)},
  "lifecycleState": ${JSON.stringify(currentState.lifecycleState)},
  "confirmationState": ${JSON.stringify(currentState.state)}
}
Current Missing Slots: ${JSON.stringify(currentState.missing_fields)}
Current Workflow State: ${currentState.state}
Next Action: ${currentState.state === 'CONFIRMED' ? 'EXECUTE_TOOL' : currentState.state === 'CONFIRMATION_REQUIRED' ? 'ASK_CONFIRMATION' : 'ASK_MISSING_SLOTS'}
`, 'STATE_MANAGER');

    return currentState;
  } catch (error) {
    Logger.error('Failed to process conversation state turn via Groq', error, 'STATE_MANAGER');
    return getSessionState(callSid);
  }
};
