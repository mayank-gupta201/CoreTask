import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

// Strict limiter for authentication routes
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: isDev ? 100 : 15, // More lenient in development
    standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    message: {
        title: 'Too Many Requests',
        status: 429,
        detail: 'Too many authentication attempts requested from this IP, please try again after 15 minutes.'
    }
});

// General limiter for all other /api routes
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        title: 'Too Many Requests',
        status: 429,
        detail: 'Too many requests generated from this IP, please try again after 15 minutes.'
    }
});

// Feature 4: Strict rate limiter for AI routes (chat + ai-breakdown)
// 5 requests per 1-minute window to prevent Gemini API quota abuse
export const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: isDev ? 10 : 5, // Slightly more lenient in dev
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        title: 'Too Many Requests',
        status: 429,
        detail: 'AI request limit reached. Please wait 1 minute before trying again (max 5 requests/minute).'
    }
});
