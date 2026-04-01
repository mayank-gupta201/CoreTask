import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';

export const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
        process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                },
            }
            : undefined,
});

export const loggerMiddleware = pinoHttp({
    logger,
    genReqId: function (req) {
        return req.id || randomUUID();
    },
});
