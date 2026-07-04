import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;
console.log('OpenAI Key Length:', apiKey?.length);
console.log('OpenAI Key Starts With:', apiKey?.substring(0, 15));

const openai = new OpenAI({ apiKey });

async function testOpenAI() {
  try {
    console.log('Calling OpenAI Chat Completion...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello' }],
    });
    console.log('✅ Success! Response:', response.choices[0]?.message?.content);
  } catch (err: any) {
    console.error('❌ Failed:', err.message || err);
  }
}

testOpenAI();
