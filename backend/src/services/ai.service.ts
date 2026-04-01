import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../middlewares/logger.middleware';
import { ProblemDetails } from '../errors';

// Lazy initialization — reads .env at call time, not at import time
let _genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
    if (!_genAI) {
        const key = process.env.GEMINI_API_KEY || '';
        if (!key) {
            throw new ProblemDetails({
                title: 'AI Service Unavailable',
                status: 503,
                detail: 'GEMINI_API_KEY is not configured on the server.',
            });
        }
        _genAI = new GoogleGenerativeAI(key);
    }
    return _genAI;
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

export class AIService {
    async breakdownTask(goalContext: string) {
        try {
            const genAI = getGenAI();
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            let tasks = [];
            try {
                const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                tasks = JSON.parse(cleanedText);
            } catch (parseError) {
                logger.error({ err: parseError, raw: responseText }, 'Failed to parse AI response as JSON');
                throw new ProblemDetails({
                    title: 'AI Parsing Error',
                    status: 500,
                    detail: `The AI provided an invalid response format: ${responseText}`,
                });
            }

            return tasks;

        } catch (error: any) {
            logger.error({ err: error }, 'Failed to generate task breakdown from AI');
            if (error instanceof ProblemDetails) throw error;
            throw new ProblemDetails({
                title: 'AI Generation Failed',
                status: 500,
                detail: error.message || 'An error occurred while communicating with the AI service.',
            });
        }
    }

    async chat(message: string, history: { role: string; content: string }[]) {
        try {
            const genAI = getGenAI();
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            // Build conversation history for Gemini
            const chatHistory = history.map((msg) => ({
                role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
                parts: [{ text: msg.content }],
            }));

            const chat = model.startChat({
                history: [
                    { role: 'user' as const, parts: [{ text: 'System instruction: ' + CHAT_SYSTEM_PROMPT }] },
                    { role: 'model' as const, parts: [{ text: 'Understood! I am TaskMaster AI. I can help you create tasks, answer questions, and assist with productivity. How can I help you today?' }] },
                    ...chatHistory,
                ],
            });

            const result = await chat.sendMessage(message);
            const responseText = result.response.text();

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
            throw new ProblemDetails({
                title: 'Chat Failed',
                status: 500,
                detail: error.message || 'Failed to get AI response.',
            });
        }
    }
}

export const aiService = new AIService();
