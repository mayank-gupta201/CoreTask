import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { loggerMiddleware, logger } from './middlewares/logger.middleware';
import { errorHandler } from './errors';
import { apiRouter } from './routes';
import { emailQueue, connection } from './queue';
import { createRecurringTaskWorker } from './workers/recurringTaskWorker';
import './workers/criticalPathWorker';
import passport from './middlewares/passport.middleware';
// Initialize db connection and drizzle
import './db';


import { createServer } from 'http';
import { initSocket } from './socket';

const app = express();
const httpServer = createServer(app);
initSocket(httpServer);

app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173', credentials: true })); // Needs explicit origin for credentials/cookies
app.use(cookieParser());
app.use(express.json());
app.use(loggerMiddleware);
app.use(passport.initialize());

app.use('/api', apiRouter);

// Basic health check
app.get('/health', (req, res) => {
    res.send('OK');
});

// Mock endpoint to trigger email queue
app.post('/api/test-email', async (req, res) => {
    await emailQueue.add('sendEmail', { to: 'test@example.com', subject: 'Hello' });
    res.json({ message: 'Email queued' });
});

// Global Error Handler (RFC 7807) MUST be at the end
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);

    // Initialize the recurring task worker
    try {
        createRecurringTaskWorker(connection);
        logger.info('Recurring task worker initialized');
    } catch (e) {
        logger.warn('Could not initialize recurring task worker (Redis may be unavailable)');
    }
});
