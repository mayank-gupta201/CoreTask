import { useState, useRef, useEffect } from 'react';
import { api } from '@/api/axios';
import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle, X, Send, Loader2, Bot, User, CheckCircle2 } from 'lucide-react';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    tasksCreated?: { id: string; title: string }[];
}

export function AIChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: "Hi! I'm **TaskMaster AI** 🤖\n\nI can help you:\n- **Create tasks** — just tell me what you need to do\n- **Answer questions** — about anything!\n\nTry: \"Create a task to review PR #42\"" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const sendMessage = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: trimmed };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            // Send conversation history (exclude the initial greeting)
            const history = newMessages.slice(1).map(m => ({
                role: m.role,
                content: m.content,
            }));

            const res = await api.post('/chat', {
                message: trimmed,
                history: history.slice(0, -1), // exclude the current message
            });

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: res.data.message || 'I processed your request.',
                tasksCreated: res.data.tasksCreated,
            };

            setMessages(prev => [...prev, assistantMessage]);

            // Refresh task list if tasks were created
            if (res.data.tasksCreated?.length > 0) {
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
            }
        } catch (error: any) {
            let errorMsg = 'Something went wrong. Please try again.';
            const detail = error.response?.data?.detail;
            if (typeof detail === 'string' && detail.length < 200) {
                errorMsg = detail;
            } else if (error.response?.status === 429) {
                errorMsg = 'AI is rate-limited. Please wait a moment and try again.';
            } else if (error.response?.status === 503) {
                errorMsg = 'AI service is unavailable. Please check the API key configuration.';
            }
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `⚠️ ${errorMsg}`,
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Simple markdown-lite renderer
    const renderContent = (text: string) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code class="px-1 py-0.5 bg-muted rounded text-xs">$1</code>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${isOpen
                    ? 'bg-muted text-muted-foreground hover:bg-muted/80 scale-90'
                    : 'bg-primary text-primary-foreground hover:scale-105 hover:shadow-xl'
                    }`}
            >
                {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
            </button>

            {/* Chat panel */}
            {isOpen && (
                <div className="fixed bottom-20 right-6 z-50 w-[380px] max-h-[560px] rounded-2xl border border-border/60 bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                    {/* Header */}
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/60 bg-card">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[13px] font-semibold">TaskMaster AI</p>
                            <p className="text-[10px] text-muted-foreground">Ask anything or create tasks</p>
                        </div>
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[300px] max-h-[400px]">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'assistant' && (
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <Bot className="h-3 w-3 text-primary" />
                                    </div>
                                )}
                                <div className={`max-w-[85%] space-y-2`}>
                                    <div
                                        className={`px-3 py-2 rounded-xl text-[13px] leading-relaxed ${msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground rounded-br-md'
                                            : 'bg-muted/50 text-foreground rounded-bl-md border border-border/40'
                                            }`}
                                        dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                                    />

                                    {/* Task creation indicator */}
                                    {msg.tasksCreated && msg.tasksCreated.length > 0 && (
                                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-lg p-2.5 space-y-1.5">
                                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                <span className="text-[11px] font-semibold">{msg.tasksCreated.length} task{msg.tasksCreated.length > 1 ? 's' : ''} created</span>
                                            </div>
                                            {msg.tasksCreated.map((task, j) => (
                                                <div key={j} className="text-[11px] text-emerald-600 dark:text-emerald-400/80 pl-5 truncate">
                                                    • {task.title}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <User className="h-3 w-3 text-foreground/60" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex gap-2 items-start">
                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Bot className="h-3 w-3 text-primary" />
                                </div>
                                <div className="bg-muted/50 border border-border/40 rounded-xl rounded-bl-md px-4 py-3">
                                    <div className="flex gap-1.5">
                                        <div className="h-1.5 w-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                                        <div className="h-1.5 w-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                                        <div className="h-1.5 w-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t border-border/60 p-3">
                        <div className="flex gap-2 items-end">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask me anything..."
                                rows={1}
                                className="flex-1 min-h-[36px] max-h-[100px] rounded-lg border border-border/60 bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                                disabled={isLoading}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!input.trim() || isLoading}
                                className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-smooth shrink-0"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">Powered by Gemini AI</p>
                    </div>
                </div>
            )}
        </>
    );
}
