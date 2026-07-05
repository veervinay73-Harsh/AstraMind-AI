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

export interface IntentResult {
  intent: 'BOOK_APPOINTMENT' | 'CANCEL_APPOINTMENT' | 'RESCHEDULE_APPOINTMENT' | 'ASK_HOSPITAL_INFORMATION' | 'TALK_TO_HUMAN' | 'UNKNOWN';
  confidence: number;
}

export const classifyIntent = async (text: string): Promise<IntentResult> => {
  try {
    const groq = getGroqClient();

    const systemPrompt = `You are a real-time hospital receptionist intent classifier.
Analyze the user request and classify their intent into exactly one of the following categories:
- BOOK_APPOINTMENT: User wants to schedule/book a new appointment.
- CANCEL_APPOINTMENT: User wants to cancel an existing appointment.
- RESCHEDULE_APPOINTMENT: User wants to change the date, time, or doctor of an existing appointment.
- ASK_HOSPITAL_INFORMATION: User is asking questions about hospital address, hours, doctors, services, or general details.
- TALK_TO_HUMAN: User explicitly requests to talk to a human receptionist or doctor.
- UNKNOWN: The request is unclear, unrelated, or doesn't fit any category.

You must respond with a raw JSON object containing:
{
  "intent": "INTENT_NAME",
  "confidence": 0.00-1.00
}
Ensure confidence is a number representing your certainty. Do not include any reasoning, markdown formatting, or HTML tags in your response. Just the raw JSON.`;

    const response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Received empty content from Groq Chat Completion.');
    }

    const parsed = JSON.parse(content);
    return {
      intent: parsed.intent || 'UNKNOWN',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.0,
    };
  } catch (error) {
    Logger.error('Failed to classify intent via Groq', error, 'INTENT_CLASSIFIER');
    return {
      intent: 'UNKNOWN',
      confidence: 0.0,
    };
  }
};
