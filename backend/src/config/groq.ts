import { Groq } from 'groq-sdk';

let groqInstance: Groq | null = null;

export const getGroqClient = (): Groq => {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not defined in environment variables.');
    }
    groqInstance = new Groq({ apiKey });
  }
  return groqInstance;
};
