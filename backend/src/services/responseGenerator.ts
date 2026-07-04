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

Constraints:
1. Keep the response extremely concise and short (ideally 1 to 2 sentences). It is for text-to-speech, so avoid long paragraphs or bullet points.
2. Be polite, friendly, and professional at all times.
3. Do NOT hallucinate details. Use only the information provided in the tool execution results.
4. Do NOT output any explanations, tags, or markdown formatting. Just output the plain text response that will be read aloud.

Context:
- User Utterance: "${userUtterance}"
- Current State: ${JSON.stringify(state, null, 2)}
- Executed Tool: "${orchestratorResult.selected_tool}"
- Tool Outcome: ${JSON.stringify(orchestratorResult.result, null, 2)}

Provide only the spoken response text:`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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
