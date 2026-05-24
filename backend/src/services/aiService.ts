import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';
import { getOnboardingPrompt, getCommandBarPrompt, getMarketingPrompt } from '../prompts/systemPrompt.js';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface OnboardingQuestionResponse {
  type: 'question';
  message: string;
}

interface OnboardingRecommendationResponse {
  type: 'recommendation';
  recommended_modules: Array<{ id: string; reason: string }>;
  summary: string;
  businessType: string;
}

type OnboardingResponse = OnboardingQuestionResponse | OnboardingRecommendationResponse;

const getClient = () => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey && !env.USE_MOCK_AI) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
  }
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
};

// ---------- Mock Responses ----------

const getMockOnboardingResponse = (userMessage: string, messageCount: number): OnboardingResponse => {
  if (messageCount <= 1) {
    return {
      type: 'question',
      message: "That sounds like a great business! Do you take appointments from customers, or is it mostly walk-ins?",
    };
  }

  const modules: Array<{ id: string; reason: string }> = [
    { id: 'crm', reason: 'Essential for managing your client relationships and history.' },
    { id: 'tasks', reason: 'Helps you organize daily operational tasks.' },
  ];

  const lower = userMessage.toLowerCase();
  if (lower.includes('appointment') || lower.includes('book') || lower.includes('schedule') || lower.includes('yes')) {
    modules.push({ id: 'scheduling', reason: 'You mentioned taking appointments - this will manage your calendar.' });
  }
  if (lower.includes('product') || lower.includes('sell') || lower.includes('inventory') || lower.includes('stock')) {
    modules.push({ id: 'inventory', reason: 'To track your products and stock levels.' });
  }
  if (lower.includes('promot') || lower.includes('market') || lower.includes('grow') || lower.includes('social')) {
    modules.push({ id: 'marketing', reason: 'To help you promote your business and reach more customers.' });
  }
  modules.push({ id: 'analytics', reason: 'To track your business performance over time.' });

  return {
    type: 'recommendation',
    recommended_modules: modules,
    summary: "Great! I've analyzed your needs and set up the perfect toolkit for your business.",
    businessType: 'general',
  };
};

const getMockCommandResponse = (command: string) => {
  const lower = command.toLowerCase();
  if (lower.includes('book') || lower.includes('appointment')) {
    return { action: 'book_appointment', data: { title: 'Appointment', date: 'tomorrow', time: '14:00' } };
  }
  if (lower.includes('task')) {
    return { action: 'create_task', data: { title: 'New task from command', priority: 'medium' } };
  }
  return { action: 'unknown', message: "I'm not sure how to help with that. Try 'Book an appointment for tomorrow at 3pm'." };
};

const getMockMarketingResponse = () => ({
  sms: '🔥 Flash Sale! 20% off all services this week only. Book now before slots fill up! Reply BOOK to reserve.',
  email: {
    subject: '✨ Exclusive Offer Just For You!',
    body: "Hi there!\n\nWe're running a special promotion this week - 20% off all our services!\n\nDon't miss out on this limited-time offer. Book your appointment today.\n\nSee you soon!",
  },
  social: '✨ FLASH SALE ALERT ✨\n\n20% OFF all services this week! 🎉\n\nLimited slots available - book now! Link in bio 👆\n\n#SmallBusiness #FlashSale #BookNow #SpecialOffer',
});

// ---------- Real AI Calls ----------

const callGemini = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  const genAI = getClient();
  if (!genAI) throw new Error('AI client not available');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const fullPrompt = `${systemPrompt}\n\nUSER INPUT: "${userPrompt}"`;
  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

const callGeminiWithHistory = async (systemPrompt: string, history: ConversationMessage[]): Promise<string> => {
  const genAI = getClient();
  if (!genAI) throw new Error('AI client not available');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const conversationText = history
    .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
    .join('\n');

  const fullPrompt = `${systemPrompt}\n\nCONVERSATION SO FAR:\n${conversationText}\n\nRespond to the latest user message. Remember to respond with valid JSON only.`;

  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// ---------- Exported Service Functions ----------

export const processOnboardingMessage = async (
  conversationHistory: ConversationMessage[],
): Promise<OnboardingResponse> => {
  if (env.USE_MOCK_AI) {
    console.log('Using Mock AI for onboarding');
    const userMessages = conversationHistory.filter(m => m.role === 'user');
    const lastMessage = userMessages[userMessages.length - 1]?.content || '';
    return getMockOnboardingResponse(lastMessage, userMessages.length);
  }

  try {
    const systemPrompt = getOnboardingPrompt();
    const text = await callGeminiWithHistory(systemPrompt, conversationHistory);
    return JSON.parse(text) as OnboardingResponse;
  } catch (error) {
    console.error('AI onboarding error:', error);
    const userMessages = conversationHistory.filter(m => m.role === 'user');
    return getMockOnboardingResponse(userMessages[userMessages.length - 1]?.content || '', userMessages.length);
  }
};

export const processCommand = async (command: string): Promise<any> => {
  if (env.USE_MOCK_AI) {
    console.log('Using Mock AI for command');
    return getMockCommandResponse(command);
  }

  try {
    const systemPrompt = getCommandBarPrompt();
    const text = await callGemini(systemPrompt, command);
    return JSON.parse(text);
  } catch (error) {
    console.error('AI command error:', error);
    return getMockCommandResponse(command);
  }
};

export const generateMarketingContent = async (brief: string): Promise<any> => {
  if (env.USE_MOCK_AI) {
    console.log('Using Mock AI for marketing');
    return getMockMarketingResponse();
  }

  try {
    const systemPrompt = getMarketingPrompt();
    const text = await callGemini(systemPrompt, brief);
    return JSON.parse(text);
  } catch (error) {
    console.error('AI marketing error:', error);
    return getMockMarketingResponse();
  }
};
