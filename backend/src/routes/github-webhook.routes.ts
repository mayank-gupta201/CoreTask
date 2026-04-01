import { Router } from 'express';
import { githubWebhookController } from '../controllers/github-webhook.controller';

export const webhookRouter = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Feature 7: GitHub Webhook
 * POST /api/webhooks/github
 * 
 * This route does NOT use authentication middleware — it uses
 * GitHub's HMAC SHA-256 signature verification instead.
 */
webhookRouter.post('/github', asyncHandler(
    githubWebhookController.handleWebhook.bind(githubWebhookController)
));
