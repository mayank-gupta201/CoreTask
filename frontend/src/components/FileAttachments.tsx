import { useState, useRef, useCallback } from 'react';
import { api } from '@/api/axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Image, Paperclip, Loader2, Download, Trash2 } from 'lucide-react';

interface Attachment {
    id: string;
    taskId: string;
    fileName: string;
    fileUrl: string;
    downloadUrl: string;  // Feature 3: Presigned URL for secure download
    fileSize: number;
    mimeType: string;
    createdAt: string;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(mimeType: string) {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
    return <FileText className="h-4 w-4 text-orange-500" />;
}

export function FileAttachments({ taskId }: { taskId: string }) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
        queryKey: ['attachments', taskId],
        queryFn: async () => {
            const res = await api.get(`/tasks/${taskId}/attachments`);
            return res.data;
        },
        enabled: !!taskId,
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post(`/tasks/${taskId}/attachments`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attachments', taskId] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (attachmentId: string) => {
            await api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attachments', taskId] });
        },
    });

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        setUploading(true);
        for (const file of Array.from(files)) {
            try {
                await uploadMutation.mutateAsync(file);
            } catch (e) {
                // toast error in production
            }
        }
        setUploading(false);
    }, [uploadMutation]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Paperclip className="h-4 w-4" />
                Attachments
                {attachments.length > 0 && (
                    <span className="text-xs text-muted-foreground">({attachments.length})</span>
                )}
            </div>

            {/* Drop zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-smooth ${isDragging
                    ? 'border-primary bg-primary/5 scale-[0.99]'
                    : 'border-border/60 hover:border-primary/40 hover:bg-muted/30'
                    }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
                {uploading ? (
                    <div className="flex flex-col items-center gap-2 py-1">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">Uploading...</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1.5 py-1">
                        <Upload className="h-5 w-5 text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground">
                            Drop files here or <span className="text-primary font-medium">browse</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground/40">Max 10MB — Images, PDFs, Docs</span>
                    </div>
                )}
            </div>

            {/* Attachment list */}
            {isLoading ? (
                <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
            ) : (
                attachments.length > 0 && (
                    <div className="space-y-1.5">
                        {attachments.map((att) => (
                            <div
                                key={att.id}
                                className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 border border-border/40 group hover:bg-muted/50 transition-smooth"
                            >
                                {getFileIcon(att.mimeType)}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{att.fileName}</p>
                                    <p className="text-[10px] text-muted-foreground">{formatFileSize(att.fileSize)}</p>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
                                    {/* Feature 3: Use presigned downloadUrl instead of raw fileUrl */}
                                    <a
                                        href={att.downloadUrl || att.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background"
                                    >
                                        <Download className="h-3 w-3" />
                                    </a>
                                    <button
                                        onClick={() => deleteMutation.mutate(att.id)}
                                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
}
