import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useSocket } from '@/hooks/useSocket';
import { useEffect } from 'react';
import { FileText, Download, Loader2, Calendar, Filter, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportGenerationStatus } from '@/components/ReportGenerationStatus';

const REPORT_TYPES = [
    { value: 'STATUS', label: 'Status Report', description: 'Task summary, blockers, and completion trends' },
    { value: 'TIME_VARIANCE', label: 'Time Variance', description: 'Estimated vs logged hours analysis' },
    { value: 'COST', label: 'Cost Report', description: 'Budget vs actual cost with CPI' },
    { value: 'RESOURCE', label: 'Resource Availability', description: 'Team allocation grid' },
    { value: 'TIMESHEET', label: 'Timesheet Report', description: 'Hours logged per user per task' },
] as const;

const EXPORT_FORMATS = [
    { value: 'XLSX', label: 'Excel (.xlsx)', icon: '📊' },
    { value: 'PDF', label: 'PDF (.pdf)', icon: '📄' },
    { value: 'DOCX', label: 'Word (.docx)', icon: '📝' },
] as const;

export function ReportBuilder() {
    const { activeWorkspaceId: workspaceId } = useWorkspaceStore();
    const queryClient = useQueryClient();
    const socket = useSocket();
    
    const [selectedType, setSelectedType] = useState<string>('STATUS');
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [readyReport, setReadyReport] = useState<{ downloadUrl: string; fileName: string; format: string } | null>(null);
    const [templateName, setTemplateName] = useState('');
    const [showSaveTemplate, setShowSaveTemplate] = useState(false);

    // Listen for report:ready socket event
    useEffect(() => {
        if (!socket) return;
        const handler = (payload: any) => {
            setReadyReport({ downloadUrl: payload.downloadUrl, fileName: payload.fileName, format: payload.format });
            setActiveJobId(null);
            queryClient.invalidateQueries({ queryKey: ['generated-reports', workspaceId] });
        };
        socket.on('report:ready' as any, handler);
        return () => { socket.off('report:ready' as any, handler); };
    }, [socket, queryClient, workspaceId]);

    // Generated reports history
    const { data: generatedReports } = useQuery({
        queryKey: ['generated-reports', workspaceId],
        queryFn: async () => {
            const res = await api.get(`/workspaces/${workspaceId}/reports`);
            return res.data?.data || [];
        },
        enabled: !!workspaceId,
    });

    // Report templates
    const { data: templates } = useQuery({
        queryKey: ['report-templates', workspaceId],
        queryFn: async () => {
            const res = await api.get(`/workspaces/${workspaceId}/reports/templates`);
            return res.data?.data || [];
        },
        enabled: !!workspaceId,
    });

    // Generate report mutation
    const generateMutation = useMutation({
        mutationFn: async (format: string) => {
            const res = await api.post(`/workspaces/${workspaceId}/reports/generate`, {
                reportType: selectedType,
                format,
                config: { dateFrom, dateTo },
            });
            return res.data;
        },
        onSuccess: (data) => {
            setActiveJobId(data?.data?.jobId || null);
        },
    });

    // Save template mutation
    const saveTemplateMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post(`/workspaces/${workspaceId}/reports/templates`, {
                name: templateName || `${selectedType} Report Template`,
                reportType: selectedType,
                config: { dateFrom, dateTo },
            });
            return res.data;
        },
        onSuccess: () => {
            setShowSaveTemplate(false);
            setTemplateName('');
            queryClient.invalidateQueries({ queryKey: ['report-templates', workspaceId] });
        },
    });

    const selectedReportInfo = REPORT_TYPES.find(r => r.value === selectedType);

    return (
        <div className="flex flex-col h-full max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                        <FileText className="h-6 w-6 text-blue-600" />
                        Report Builder
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Generate and export workspace reports in multiple formats.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar — Report Type Selector */}
                <div className="lg:col-span-1 space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Report Type</h3>
                    {REPORT_TYPES.map((type) => (
                        <button
                            key={type.value}
                            onClick={() => setSelectedType(type.value)}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                                selectedType === type.value
                                    ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200 shadow-sm'
                                    : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                            }`}
                        >
                            <div className={`text-sm font-medium ${selectedType === type.value ? 'text-blue-700' : 'text-gray-900'}`}>
                                {type.label}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{type.description}</div>
                        </button>
                    ))}

                    {/* Saved Templates */}
                    {templates && templates.length > 0 && (
                        <div className="pt-4 border-t border-gray-200 mt-4">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Saved Templates</h3>
                            {templates.map((tmpl: any) => (
                                <button
                                    key={tmpl.id}
                                    onClick={() => {
                                        setSelectedType(tmpl.reportType);
                                        if (tmpl.config?.dateFrom) setDateFrom(tmpl.config.dateFrom);
                                        if (tmpl.config?.dateTo) setDateTo(tmpl.config.dateTo);
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 text-gray-700 transition-colors"
                                >
                                    {tmpl.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Main Content — Config + Preview + Export */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Config Panel */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Filter className="h-4 w-4 text-gray-400" />
                            Report Configuration
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    <Calendar className="inline h-3 w-3 mr-1" />Date From
                                </label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    <Calendar className="inline h-3 w-3 mr-1" />Date To
                                </label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Save as Template */}
                        <div className="mt-4 flex items-center gap-2">
                            {showSaveTemplate ? (
                                <div className="flex items-center gap-2 flex-1">
                                    <input
                                        type="text"
                                        placeholder="Template name..."
                                        value={templateName}
                                        onChange={(e) => setTemplateName(e.target.value)}
                                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                    <Button size="sm" onClick={() => saveTemplateMutation.mutate()} disabled={saveTemplateMutation.isPending}>
                                        {saveTemplateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
                                </div>
                            ) : (
                                <Button size="sm" variant="outline" onClick={() => setShowSaveTemplate(true)} className="text-xs gap-1">
                                    <Save className="h-3 w-3" /> Save as Template
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Report Info Card */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6">
                        <h3 className="text-lg font-semibold text-blue-900">{selectedReportInfo?.label}</h3>
                        <p className="text-sm text-blue-700 mt-1">{selectedReportInfo?.description}</p>
                        <p className="text-xs text-blue-500 mt-2">
                            Date range: {dateFrom} → {dateTo}
                        </p>
                    </div>

                    {/* Export Buttons */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Download className="h-4 w-4 text-gray-400" />
                            Export Report
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {EXPORT_FORMATS.map((format) => (
                                <Button
                                    key={format.value}
                                    onClick={() => generateMutation.mutate(format.value)}
                                    disabled={generateMutation.isPending || !!activeJobId}
                                    variant="outline"
                                    className="h-12 px-6 gap-2 text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-all"
                                >
                                    {generateMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <span className="text-lg">{format.icon}</span>
                                    )}
                                    {format.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Recent Reports */}
                    {generatedReports && generatedReports.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Reports</h3>
                            <div className="space-y-2">
                                {generatedReports.slice(0, 10).map((report: any) => (
                                    <div key={report.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">
                                                {report.format === 'XLSX' ? '📊' : report.format === 'PDF' ? '📄' : '📝'}
                                            </span>
                                            <div>
                                                <div className="text-sm font-medium text-gray-800">{report.file_name || report.fileName}</div>
                                                <div className="text-xs text-gray-500">
                                                    {report.template_name || report.report_type} · {new Date(report.generated_at || report.generatedAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        {(report.s3_url || report.s3Url) && (
                                            <a
                                                href={report.s3_url || report.s3Url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1"
                                            >
                                                <Download className="h-3 w-3" /> Download
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating generation status */}
            <ReportGenerationStatus
                isGenerating={!!activeJobId}
                readyReport={readyReport}
                onDismiss={() => setReadyReport(null)}
            />
        </div>
    );
}
