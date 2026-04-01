import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../middlewares/logger.middleware';
import { ProblemDetails } from '../errors';
import { randomUUID } from 'crypto';
import path from 'path';

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
    if (!_s3Client) {
        const region = process.env.AWS_REGION;
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!region || !accessKeyId || !secretAccessKey) {
            throw new ProblemDetails({
                title: 'S3 Not Configured',
                status: 503,
                detail: 'AWS S3 credentials are not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in .env',
            });
        }

        _s3Client = new S3Client({
            region,
            credentials: { accessKeyId, secretAccessKey },
        });
    }
    return _s3Client;
}

function getBucket(): string {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
        throw new ProblemDetails({
            title: 'S3 Not Configured',
            status: 503,
            detail: 'AWS_S3_BUCKET is not set in .env',
        });
    }
    return bucket;
}

export class S3Service {
    async uploadFile(file: Express.Multer.File, taskId: string): Promise<{ fileUrl: string; key: string }> {
        const s3 = getS3Client();
        const bucket = getBucket();
        const ext = path.extname(file.originalname);
        const key = `attachments/${taskId}/${randomUUID()}${ext}`;

        try {
            await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
            }));

            const region = process.env.AWS_REGION;
            const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

            logger.info({ key, bucket }, 'File uploaded to S3');
            return { fileUrl, key };
        } catch (error: any) {
            logger.error({ err: error }, 'S3 upload failed');
            throw new ProblemDetails({
                title: 'Upload Failed',
                status: 500,
                detail: error.message || 'Failed to upload file to S3.',
            });
        }
    }

    async deleteFile(fileUrl: string): Promise<void> {
        const s3 = getS3Client();
        const bucket = getBucket();

        // Extract key from URL
        const key = this.extractKeyFromUrl(fileUrl);

        try {
            await s3.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: key,
            }));
            logger.info({ key }, 'File deleted from S3');
        } catch (error: any) {
            logger.error({ err: error, key }, 'S3 delete failed');
            // Don't throw — best effort deletion
        }
    }

    /**
     * Feature 3: Generate a presigned URL for secure, time-limited download access.
     * Default expiration: 5 minutes (300 seconds).
     */
    async getPresignedUrl(fileUrl: string, expiresIn: number = 300): Promise<string> {
        const s3 = getS3Client();
        const bucket = getBucket();
        const key = this.extractKeyFromUrl(fileUrl);

        try {
            const command = new GetObjectCommand({
                Bucket: bucket,
                Key: key,
            });
            const signedUrl = await getSignedUrl(s3, command, { expiresIn });
            return signedUrl;
        } catch (error: any) {
            logger.error({ err: error, key }, 'Failed to generate presigned URL');
            throw new ProblemDetails({
                title: 'Presigned URL Generation Failed',
                status: 500,
                detail: error.message || 'Could not generate a secure download link.',
            });
        }
    }

    /**
     * Extracts the S3 object key from a full S3 URL.
     * Handles both path-style and virtual-hosted-style URLs.
     */
    private extractKeyFromUrl(fileUrl: string): string {
        try {
            const url = new URL(fileUrl);
            return url.pathname.slice(1); // remove leading /
        } catch {
            // If it's already a key (not a URL), return as-is
            return fileUrl;
        }
    }
}

export const s3Service = new S3Service();
