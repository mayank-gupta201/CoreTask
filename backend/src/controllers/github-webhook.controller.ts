import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { taskService } from '../services/task.service';
import { getIO } from '../socket';
import { logger } from '../middlewares/logger.middleware';
import { ProblemDetails } from '../errors';

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

/**
 * Feature 7: GitHub Webhook Controller
 * 
 * Listens for GitHub Pull Request events. When a PR is merged and its
 * description contains a task ID pattern (TASK-<uuid>), the corresponding
 * task is automatically marked as DONE and a WebSocket event is emitted.
 */
export class GitHubWebhookController {

    /**
     * Verify the GitHub webhook signature using HMAC SHA-256.
     */
    private verifySignature(payload: string, signature: string): boolean {
        if (!WEBHOOK_SECRET) {
            logger.warn('GITHUB_WEBHOOK_SECRET is not configured — skipping signature verification');
            return true; // Allow in dev when secret is not set
        }

        const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
        const digest = 'sha256=' + hmac.update(payload).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    }

    /**
     * Extract task UUIDs from PR description.
     * Supported patterns: TASK-<uuid>
     */
    private extractTaskIds(text: string): string[] {
        const uuidPattern = /TASK-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
        const matches: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = uuidPattern.exec(text)) !== null) {
            matches.push(match[1]);
        }

        return [...new Set(matches)]; // Deduplicate
    }

    async handleWebhook(req: Request, res: Response, next: NextFunction) {
        try {
            const event = req.headers['x-github-event'] as string;
            const signature = req.headers['x-hub-signature-256'] as string;

            // Get raw body for signature verification
            const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

            // Verify signature (if secret is configured)
            if (WEBHOOK_SECRET && signature) {
                const isValid = this.verifySignature(rawBody, signature);
                if (!isValid) {
                    logger.warn('GitHub webhook signature verification failed');
                    return res.status(401).json({ error: 'Invalid signature' });
                }
            }

            // Only handle pull_request events
            if (event !== 'pull_request') {
                return res.status(200).json({ message: `Event '${event}' ignored` });
            }

            const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const { action, pull_request } = payload;

            // Only process merged PRs (action === 'closed' and merged === true)
            if (action !== 'closed' || !pull_request?.merged) {
                return res.status(200).json({ message: 'PR not merged, ignoring' });
            }

            const prTitle = pull_request.title || '';
            const prBody = pull_request.body || '';
            const prUrl = pull_request.html_url || '';
            const prNumber = pull_request.number;

            // Search for task IDs in both title and body
            const taskIds = [
                ...this.extractTaskIds(prTitle),
                ...this.extractTaskIds(prBody),
            ];

            // Deduplicate
            const uniqueTaskIds = [...new Set(taskIds)];

            if (uniqueTaskIds.length === 0) {
                logger.info({ prNumber, prUrl }, 'Merged PR has no TASK-<uuid> references');
                return res.status(200).json({ message: 'No task references found in PR' });
            }

            logger.info({ prNumber, prUrl, taskIds: uniqueTaskIds }, 'Processing merged PR with task references');

            const results: { taskId: string; status: string }[] = [];

            for (const taskId of uniqueTaskIds) {
                try {
                    const updated = await taskService.updateTaskById(taskId, {
                        status: 'DONE',
                    });

                    if (updated) {
                        results.push({ taskId, status: 'updated' });
                        logger.info({ taskId, prNumber }, 'Task marked as DONE via GitHub PR merge');
                    } else {
                        results.push({ taskId, status: 'not_found' });
                    }
                } catch (error: any) {
                    logger.error({ err: error, taskId, prNumber }, 'Failed to update task from webhook');
                    results.push({ taskId, status: 'error' });
                }
            }

            return res.status(200).json({
                message: `Processed ${uniqueTaskIds.length} task(s) from PR #${prNumber}`,
                results,
            });
        } catch (error) {
            logger.error({ err: error }, 'GitHub webhook processing error');
            next(error);
        }
    }
}

export const githubWebhookController = new GitHubWebhookController();
