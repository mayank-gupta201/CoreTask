import { Router, Request, Response, NextFunction } from 'express';
import {
    taskController,
    createTaskSchema,
    updateTaskSchema,
    taskIdSchema,
    generateSubTasksSchema,
} from '../controllers/task.controller';
import { taskActivityController, commentSchema } from '../controllers/task-activity.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireWorkspace } from '../middlewares/workspace.middleware';
import { upload } from '../middlewares/upload.middleware';
import { s3Service } from '../services/s3.service';
import { attachmentRepository } from '../repositories/attachment.repository';
import { aiLimiter } from '../middlewares/rateLimiter.middleware';

export const taskRouter = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

taskRouter.use(authenticate as any);
taskRouter.use(requireWorkspace as any);

// Feature 4: AI routes have strict rate limiting
taskRouter.post('/ai-breakdown', aiLimiter as any, validate(generateSubTasksSchema), asyncHandler(taskController.generateSubTasks));

taskRouter.get('/', asyncHandler(taskController.getTasks));
taskRouter.post('/', validate(createTaskSchema), asyncHandler(taskController.createTask));
taskRouter.get('/:id', validate(taskIdSchema), asyncHandler(taskController.getTask));
taskRouter.put('/:id', validate(updateTaskSchema), asyncHandler(taskController.updateTask));
taskRouter.delete('/:id', validate(taskIdSchema), asyncHandler(taskController.deleteTask));

// Feature 6: Subtasks
taskRouter.get('/:id/subtasks', validate(taskIdSchema), asyncHandler(taskController.getSubtasks));

// Activity & Comments
taskRouter.get('/:id/activities', validate(taskIdSchema), asyncHandler(taskActivityController.getActivities));
taskRouter.post('/:id/comments', validate(taskIdSchema), validate(commentSchema), asyncHandler(taskActivityController.addComment));

// File Attachments
taskRouter.post('/:id/attachments', upload.single('file'), asyncHandler(async (req: AuthRequest, res: Response) => {
    const taskId = req.params.id as string;
    const file = req.file;
    if (!file) {
        return res.status(400).json({ detail: 'No file provided.' });
    }

    const { fileUrl } = await s3Service.uploadFile(file, taskId);
    const attachment = await attachmentRepository.create({
        taskId,
        fileName: file.originalname,
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: req.user!.userId,
    });

    return res.status(201).json(attachment);
}));

// Feature 3: Attachments now return presigned URLs
taskRouter.get('/:id/attachments', asyncHandler(async (req: AuthRequest, res: Response) => {
    const attachments = await attachmentRepository.findByTaskId(req.params.id as string);

    // Generate presigned URLs for each attachment
    const attachmentsWithSignedUrls = await Promise.all(
        attachments.map(async (att) => {
            try {
                const signedUrl = await s3Service.getPresignedUrl(att.fileUrl);
                return { ...att, downloadUrl: signedUrl };
            } catch {
                // If presigned URL generation fails (e.g., S3 not configured), fallback to raw URL
                return { ...att, downloadUrl: att.fileUrl };
            }
        })
    );

    return res.json(attachmentsWithSignedUrls);
}));

// Feature 3: Single attachment download with presigned URL
taskRouter.get('/:id/attachments/:attachmentId/download', asyncHandler(async (req: AuthRequest, res: Response) => {
    const attachment = await attachmentRepository.findById(req.params.attachmentId as string);
    if (!attachment) {
        return res.status(404).json({ detail: 'Attachment not found.' });
    }

    const signedUrl = await s3Service.getPresignedUrl(attachment.fileUrl);
    return res.json({ downloadUrl: signedUrl });
}));

taskRouter.delete('/:id/attachments/:attachmentId', asyncHandler(async (req: AuthRequest, res: Response) => {
    const attachmentId = req.params.attachmentId as string;
    const taskId = req.params.id as string;
    const attachment = await attachmentRepository.findById(attachmentId);
    if (!attachment) {
        return res.status(404).json({ detail: 'Attachment not found.' });
    }

    await s3Service.deleteFile(attachment.fileUrl);
    await attachmentRepository.delete(attachmentId, taskId);

    return res.json({ message: 'Attachment deleted.' });
}));
