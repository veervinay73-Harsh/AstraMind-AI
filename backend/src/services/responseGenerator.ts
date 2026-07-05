import { Groq } from 'groq-sdk';
import { BookingState } from './stateManager';
import { OrchestratorResult } from './orchestrator';
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

export const generateVoiceResponse = async (
  userUtterance: string,
  state: BookingState,
  orchestratorResult: OrchestratorResult
): Promise<string> => {
  try {
    const groq = getGroqClient();

    const systemPrompt = `You are a professional, polite, and concise hospital receptionist voice assistant.
Your task is to generate a natural, professional textual response for the patient based on their last utterance, their current conversation state, and the outcome of the business tool execution.

Response Tone & Style Rules:
1. Keep the response extremely concise and short (ideally 1 to 2 sentences). Avoid long paragraphs or bullet points.
2. Be polite, friendly, and professional at all times.
3. If the patient's name is known (present in the state as "patient_name"), address them respectfully using "Mr." or "Ms." based on standard gender association of their name (e.g., "Mr. John Doe", "Ms. Jane Smith"). If the gender is ambiguous or unclear, use "Hello <Name>". If the name is not known yet, address them generically.
4. Do NOT output any explanations, tags, or markdown formatting. Just output the plain text response that will be read aloud.

Conversation Flow & Booking Rules:
- When the patient wants to book an appointment (intent is "BOOK_APPOINTMENT" and state is "COLLECTING_INFORMATION"):
  Collect the missing details ONE by ONE in this EXACT order:
    1. Patient Name (patient_name) -> Ask for their name first.
    2. Mobile Number (phone) -> Once name is known, ask for their mobile number.
    3. Doctor Specialization / Department (doctor) -> Once name and mobile number are known, ask for the doctor/specialty.
    4. Preferred Date (date) -> Then ask for the preferred appointment date.
    5. Preferred Time (time) -> Finally ask for the preferred time.
  Strictly follow this order. Do not ask for a subsequent field if any prior field in the list is still missing.
- When all details are collected (state is "CONFIRMATION_REQUIRED"):
  Read back all collected details (Patient Name, Phone, Specialty, Date, Time) clearly and ask the patient to confirm the booking (e.g., "I have an appointment for Mr./Ms. <Name> on <Date> at <Time> with a <Specialty> specialist, contact number <Phone>. Would you like me to confirm this booking?").
- IMPORTANT: When the booking tool has run successfully (i.e., Executed Tool is "BOOK_APPOINTMENT" and Tool Outcome status is "BOOKED" or "SUCCESS"), you MUST output ONLY the closing message: "Thank you, Mr./Ms. [Name]. Your appointment has been successfully booked. We look forward to seeing you. Have a wonderful day. Goodbye." (Replace [Name] with the patient's name, addressing them respectfully as Mr. or Ms.). Do NOT read back the details or ask for confirmation again in this case.

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
    
    // Clean any surrounding quotes that the LLM might have returned
    return text.replace(/^"|"$/g, '');
  } catch (error) {
    Logger.error('Failed to generate voice response', error, 'RESPONSE_GENERATOR');
    return "I am sorry, I encountered an issue processing your request. Please hold on while I connect you to our support line.";
  }
};
