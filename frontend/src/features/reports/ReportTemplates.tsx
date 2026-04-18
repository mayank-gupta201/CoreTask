import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { FileText, Trash2, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REPORT_TYPE_LABELS: Record<string, string> = {
    STATUS: 'Status Report',
    TIME_VARIANCE: 'Time Variance',
    COST: 'Cost Report',
    RESOURCE: 'Resource Availability',
    TIMESHEET: 'Timesheet Report',
};

export function ReportTemplates() {
    const { activeWorkspaceId: workspaceId } = useWorkspaceStore();
    const queryClient = useQueryClient();

    const { data: templates, isLoading } = useQuery({
        queryKey: ['report-templates', workspaceId],
        queryFn: async () => {
            const res = await api.get(`/workspaces/${workspaceId}/reports/templates`);
            return res.data?.data || [];
        },
        enabled: !!workspaceId,
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/workspaces/${workspaceId}/reports/templates/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['report-templates', workspaceId] });
        },
    });

    const runMutation = useMutation({
        mutationFn: async (template: any) => {
            const res = await api.post(`/workspaces/${workspaceId}/reports/generate`, {
                reportType: template.reportType,
                format: 'XLSX',
                config: template.config || {},
            });
            return res.data;
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                    <FileText className="h-6 w-6 text-blue-600" />
                    Report Templates
                </h1>
                <p className="text-sm text-gray-500 mt-1">Manage saved report configurations for quick re-use.</p>
            </div>

            {templates && templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-2xl border border-gray-200">
                    <FileText className="h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600">No Templates Yet</h3>
                    <p className="text-sm text-gray-400 mt-1">Save a report configuration from the Report Builder to see it here.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {templates?.map((tmpl: any) => (
                        <div
                            key={tmpl.id}
                            className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900">{tmpl.name}</h4>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                            {REPORT_TYPE_LABELS[tmpl.reportType] || tmpl.reportType}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            Created {new Date(tmpl.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => runMutation.mutate(tmpl)}
                                    disabled={runMutation.isPending}
                                    className="gap-1 text-xs"
                                >
                                    {runMutation.isPending ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Play className="h-3 w-3" />
                                    )}
                                    Run Report
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteMutation.mutate(tmpl.id)}
                                    disabled={deleteMutation.isPending}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {runMutation.isSuccess && (
                <div className="fixed bottom-6 right-6 bg-green-50 border border-green-200 rounded-xl px-4 py-3 shadow-lg animate-in slide-in-from-bottom-5">
                    <p className="text-sm text-green-800 font-medium">✓ Report generation started! You'll be notified when ready.</p>
                </div>
            )}
        </div>
    );
}
