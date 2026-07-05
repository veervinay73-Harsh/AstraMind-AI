
import { KBRepository } from '../repositories/kb.repository';
import { Logger } from '../utils/logger';
import { getGroqClient } from '../config/groq';

export interface FAQResult {
  status: 'ANSWER_FOUND' | 'UNKNOWN';
  question?: string;
  answer?: string;
  confidence?: number;
}

export const queryKnowledgeBase = async (
  hospitalId: string,
  userQuestion: string
): Promise<FAQResult> => {
  try {
    // 1. Retrieve active FAQ articles by hospitalId (tenant isolation)
    const articles = await KBRepository.findByHospital(hospitalId);
    
    if (articles.length === 0) {
      Logger.info(`No active KB articles found for hospital: ${hospitalId}`, 'KB_ENGINE');
      return { status: 'UNKNOWN' };
    }

    const groq = getGroqClient();

    // Map articles to a minimal representation for prompt token optimization
    const articleList = articles.map((art) => ({
      id: art.id,
      category: art.category,
      question: art.question,
      answer: art.answer,
    }));

    const systemPrompt = `You are a real-time hospital receptionist FAQ assistant.
Your task is to find the best matching Knowledge Base article that answers the user's question semantically.

Available Articles:
${JSON.stringify(articleList, null, 2)}

Rules for matching:
- Match the user's question semantically. Even if the wording is different (e.g., "what time do you open?" vs "hospital timings"), if it refers to the same intent, match it.
- Calculate a confidence score between 0.00 and 1.00 indicating how well the article answers the question.
- If there is a matching article and the confidence is 0.70 or higher, respond with:
{
  "status": "ANSWER_FOUND",
  "question": "The original matched question from the article",
  "answer": "The answer from the article",
  "confidence": 0.95
}
- If no article matches or the best match has a confidence below 0.70, respond with:
{
  "status": "UNKNOWN"
}

Do not include any explanation or markdown formatting in your response. Just return the raw JSON object.`;

    const response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuestion },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.0, // Force deterministic classification
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Received empty content from Groq KB Engine.');
    }

    const parsed = JSON.parse(content) as FAQResult;
    
    if (parsed.status === 'ANSWER_FOUND' && parsed.confidence && parsed.confidence >= 0.70) {
      return {
        status: 'ANSWER_FOUND',
        question: parsed.question,
        answer: parsed.answer,
        confidence: parsed.confidence,
      };
    }

    return { status: 'UNKNOWN' };
  } catch (error) {
    Logger.error(`Error querying knowledge base for question: "${userQuestion}"`, error, 'KB_ENGINE');
    return { status: 'UNKNOWN' };
  }
};
