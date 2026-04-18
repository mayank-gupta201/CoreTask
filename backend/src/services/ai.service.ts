import Groq from 'groq-sdk';
import crypto from 'crypto';
import { logger } from '../middlewares/logger.middleware';
import { ProblemDetails } from '../errors';
import { cacheService } from './cache.service';

// Lazy initialization — reads .env at call time, not at import time
let _groq: Groq | null = null;
function getGroq() {
    if (!_groq) {
        const key = process.env.GROQ_API_KEY || '';
        if (!key) {
            throw new ProblemDetails({
                title: 'AI Service Unavailable',
                status: 503,
                detail: 'GROQ_API_KEY is not configured on the server.',
            });
        }
        _groq = new Groq({ apiKey: key });
    }
    return _groq;
}

const CHAT_SYSTEM_PROMPT = `You are TaskMaster AI, a smart productivity assistant embedded in a task management application.

You can do two things:
1. **Answer questions** — general knowledge, coding help, productivity tips, anything the user asks.
2. **Create tasks** — when the user asks you to create, add, or make a task (or multiple tasks), respond with a JSON action block.

RULES FOR TASK CREATION:
- When the user wants to create tasks, include a JSON block in your response wrapped in <tasks> tags.
- Format: <tasks>[{"title":"...", "priority":"MEDIUM", "category":"..."}]</tasks>
- Priority must be one of: LOW, MEDIUM, HIGH, URGENT
- You can create multiple tasks at once.
- Always include a friendly message BEFORE the <tasks> block explaining what you're creating.

RULES FOR CONVERSATION:
- Be concise, friendly, and helpful.
- Use markdown formatting for readability (bold, lists, code blocks).
- If the user's request is ambiguous, ask for clarification.
- Do NOT wrap your entire response in code blocks.

Example task creation:
User: "Create a task to buy groceries"
You: "Sure! I'll create that task for you. ✅
<tasks>[{"title":"Buy groceries","priority":"MEDIUM","category":"Personal"}]</tasks>"

Example multi-task:
User: "Help me plan a website launch"
You: "Here are the tasks for your website launch! 🚀
<tasks>[{"title":"Finalize website design","priority":"HIGH","category":"Design"},{"title":"Set up hosting and domain","priority":"HIGH","category":"DevOps"},{"title":"Write launch announcement","priority":"MEDIUM","category":"Marketing"}]</tasks>"`;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callGroqWithRetry(messages: any[], maxRetries = 3): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const groq = getGroq();
            const response = await groq.chat.completions.create({
                messages: messages,
                model: 'llama-3.1-8b-instant',
            });
            return response.choices[0]?.message?.content || '';
        } catch (error: any) {
            if (error?.status === 429) {
                const backoffDelay = 5000 * Math.pow(2, attempt - 1);
                logger.warn(`Rate limit exceeded on Groq API. Attempt ${attempt} of ${maxRetries}. Retrying in ${backoffDelay}ms...`);
                if (attempt < maxRetries) {
                    await delay(backoffDelay);
                    continue;
                }
            }
            throw error; // Throw immediately for non-429 errors or if we exhaust retries
        }
    }
    throw new Error('Groq API failed after max retries');
}

export class AIService {
    async breakdownTask(goalContext: string) {
        try {
            const prompt = `You are an expert productivity assistant and project manager. The user wants to achieve the following goal or task: "${goalContext}". 
            Break this down into smaller, highly actionable, and logical sub-tasks. 
            Return the result ONLY as a valid JSON array of objects. Do not include markdown formatting like \`\`\`json or \`\`\`. 
            Each object in the array should have the following strict format:
            {
                "title": "A clear, concise, actionable step",
                "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
                "category": "A short category name (e.g. Planning, Execution, Review)"
            }
            Generate between 3 to 7 high-quality tasks depending on the complexity of the goal.`;

            // Hash the goalContext to use as a cache key
            const hash = crypto.createHash('sha256').update(goalContext).digest('hex');
            const cacheKey = `ai:subtask:${hash}`;

            // Check cache before computing; if miss, calls fetcher and stores for 24 hours (86400s)
            const tasks = await cacheService.getOrSet(cacheKey, async () => {
                const responseText = await callGroqWithRetry([{ role: 'user', content: prompt }]);
                
                let parsedTasks: any[] = [];
                try {
                    const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                    parsedTasks = JSON.parse(cleanedText);
                } catch (parseError) {
                    logger.error({ err: parseError, raw: responseText }, 'Failed to parse AI response as JSON');
                    throw new ProblemDetails({
                        title: 'AI Parsing Error',
                        status: 500,
                        detail: `The AI provided an invalid response format: ${responseText}`,
                    });
                }
                return parsedTasks;
            }, 86400);

            return tasks;
        } catch (error: any) {
            logger.error({ err: error }, 'Failed to generate task breakdown from AI');
            if (error instanceof ProblemDetails) throw error;
            if (error.status === 429 || error.statusCode === 429) {
                throw new ProblemDetails({
                    title: 'Rate Limited',
                    status: 429,
                    detail: 'AI rate limit exceeded. Please wait a moment and try again.',
                });
            }
            throw new ProblemDetails({
                title: 'AI Generation Failed',
                status: 500,
                detail: error.message || 'An error occurred while communicating with the AI service.',
            });
        }
    }

    async chat(message: string, history: { role: string; content: string }[]) {
        try {
            // Build conversation history for Groq
            const chatHistory = history.map((msg) => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content,
            }));

            const messages = [
                { role: 'system', content: CHAT_SYSTEM_PROMPT },
                { role: 'assistant', content: 'Understood! I am TaskMaster AI. I can help you create tasks, answer questions, and assist with productivity. How can I help you today?' },
                ...chatHistory,
                { role: 'user', content: message }
            ];

            const responseText = await callGroqWithRetry(messages);

            // Parse out any task creation actions
            let tasks: any[] = [];
            let cleanResponse = responseText;

            const taskMatch = responseText.match(/<tasks>([\s\S]*?)<\/tasks>/);
            if (taskMatch) {
                try {
                    const cleanedJson = taskMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
                    tasks = JSON.parse(cleanedJson);
                    cleanResponse = responseText.replace(/<tasks>[\s\S]*?<\/tasks>/, '').trim();
                } catch (e) {
                    logger.warn('Failed to parse task JSON from chat response');
                }
            }

            return {
                message: cleanResponse,
                tasks,
            };

        } catch (error: any) {
            logger.error({ err: error }, 'Chat error');
            if (error instanceof ProblemDetails) throw error;
            if (error.status === 429 || error.statusCode === 429) {
                throw new ProblemDetails({
                    title: 'Rate Limited',
                    status: 429,
                    detail: 'AI rate limit exceeded. Please wait a moment and try again.',
                });
            }
            throw new ProblemDetails({
                title: 'Chat Failed',
                status: 500,
                detail: error.message || 'Failed to get AI response.',
            });
        }
    }
}

export const aiService = new AIService();
