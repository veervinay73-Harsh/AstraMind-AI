import { BookingState } from './stateManager';
import { OrchestratorResult } from './orchestrator';
import { Logger } from '../utils/logger';
import { getGroqClient } from '../config/groq';

export const generateVoiceResponse = async (
  userUtterance: string,
  state: BookingState,
  orchestratorResult: OrchestratorResult,
  callSid?: string
): Promise<string> => {
  try {
    const groq = getGroqClient();

    Logger.info(`[RESPONSE_GENERATOR] Generating response for Session ID: "${callSid || 'N/A'}" -> Operation: "${state.operation || 'N/A'}", Patient: "${state.patient_name || 'N/A'}", Phone: "${state.phone || 'N/A'}", Doctor: "${state.doctor || 'N/A'}"`, 'RESPONSE_GENERATOR');

    const systemPrompt = `You are a professional, polite, and concise hospital receptionist voice assistant.
Your task is to generate a natural, professional textual response for the patient based on their last utterance, their current conversation state, and the outcome of the business tool execution.

Response Tone & Style Rules:
1. Keep the response extremely concise and short (ideally 1 to 2 sentences). Avoid long paragraphs or bullet points.
2. Be polite, friendly, and professional at all times.
3. NEVER use titles such as Mr., Mrs., Ms., Sir, or Madam. NEVER ask for gender. Address the patient ONLY by their collected name (e.g., "Thank you [Patient Name].").
4. Do NOT output any explanations, tags, or markdown formatting. Just output the plain text response that will be read aloud.

Conversation Flow & Greet Rules:
- If this is the start of the conversation (first turn or welcome) and the patient is identified (patientExists is true):
  Say: "Welcome back [Patient Name]. How can I assist you today?"
- If the patient wants to book an appointment (operation is "BOOK"):
  Collect missing fields one by one in order: Name -> Phone -> Doctor/Spec -> Date -> Time.
  If all are collected, read summary and ask: "Would you like to confirm your appointment?"
- If the patient wants to reschedule (operation is "RESCHEDULE"):
  Ask for missing slots: Date -> Time.
  Once both are present, read back the new details and ask: "Would you like to confirm rescheduling your appointment?"
- If the patient wants to change the doctor (operation is "CHANGE_DOCTOR"):
  Recommend doctors from the same specialization or let them choose a doctor.
  Once doctor is chosen, ask: "Would you like to confirm changing your doctor to [Doctor Name]?"
- If the patient wants to change date (operation is "CHANGE_DATE"):
  Once date is provided, ask: "Would you like to confirm changing the date of your appointment to [Date]?"
- If the patient wants to change time (operation is "CHANGE_TIME"):
  Once time is provided, ask: "Would you like to confirm changing the time of your appointment to [Time]?"
- If the patient wants to cancel (operation is "CANCEL"):
  Ask: "Would you like to confirm cancelling your upcoming appointment?"
  
*** CRITICAL SCRIPTED RESPONSES ***
If a tool was executed successfully, you MUST respond exactly verbatim with the scripts below:

1. SUCCESSFUL BOOKING (Executed Tool: "BOOK_APPOINTMENT", Tool Outcome status is "BOOKED"):
"Thank you. Your appointment has been successfully booked with [Doctor Name] on [Date] at [Time]. We look forward to seeing you. Have a wonderful day."

2. SUCCESSFUL CANCELLATION (Executed Tool: "CANCEL_APPOINTMENT", Tool Outcome status is "CANCELLED"):
"Your appointment has been cancelled successfully. Thank you for contacting AstraMind."

3. SUCCESSFUL RESCHEDULE (Executed Tool: "RESCHEDULE_APPOINTMENT", Tool Outcome status is "RESCHEDULED"):
"Your appointment has been successfully rescheduled with [Doctor Name] to [Date] at [Time]. We look forward to seeing you."

4. SUCCESSFUL DOCTOR CHANGE (Executed Tool: "CHANGE_DOCTOR", Tool Outcome status is "SUCCESS"):
"The doctor for your appointment has been successfully changed to [Doctor Name]."

5. SUCCESSFUL DATE CHANGE (Executed Tool: "CHANGE_DATE", Tool Outcome status is "SUCCESS"):
"The date of your appointment has been successfully changed to [Date]."

6. SUCCESSFUL TIME CHANGE (Executed Tool: "CHANGE_TIME", Tool Outcome status is "SUCCESS"):
"The time of your appointment has been successfully changed to [Time]."

7. APPOINTMENT STATUS (Executed Tool: "APPOINTMENT_STATUS"):
If an upcoming appointment is found, say: "Your appointment with [Doctor Name] on [Date] at [Time] is currently [Status]."
Otherwise, say: "You do not have any upcoming appointments."

8. UPCOMING APPOINTMENTS list (Executed Tool: "UPCOMING_APPOINTMENTS"):
Read back the list of upcoming appointments. If none, say: "You do not have any upcoming appointments."

9. PAST APPOINTMENTS list (Executed Tool: "PAST_APPOINTMENTS"):
Read back the list of past appointments. If none, say: "You do not have any past appointments."

Context:
- User Utterance: "${userUtterance}"
- Current State: ${JSON.stringify(state, null, 2)}
- Executed Tool: "${orchestratorResult.selected_tool}"
- Tool Outcome: ${JSON.stringify(orchestratorResult.result, null, 2)}

Provide only the spoken response text:`;

    const response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.3,
      max_tokens: 150,
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new Error('Received empty response from Groq Response Generator.');
    }
    
    return text.replace(/^"|"$/g, '');
  } catch (error) {
    Logger.error('Failed to generate voice response', error, 'RESPONSE_GENERATOR');
    return "I am sorry, I encountered an issue processing your request. Please hold on while I connect you to our support line.";
  }
};
