import { useEffect, useState } from 'react';
import { Loader2, Download, X, Check } from 'lucide-react';

interface ReportGenerationStatusProps {
    isGenerating: boolean;
    readyReport: { downloadUrl: string; fileName: string; format: string } | null;
    onDismiss: () => void;
}

/**
 * Floating notification component that appears in the bottom-right when a report is being generated.
 * Shows spinner during generation and download link when ready.
 * Auto-dismisses 5 seconds after the download link appears.
 */
export function ReportGenerationStatus({ isGenerating, readyReport, onDismiss }: ReportGenerationStatusProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isGenerating || readyReport) {
            setVisible(true);
        }
    }, [isGenerating, readyReport]);

    // Auto-dismiss after 5 seconds when report is ready
    useEffect(() => {
        if (readyReport) {
            const timer = setTimeout(() => {
                setVisible(false);
                onDismiss();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [readyReport, onDismiss]);

    if (!visible) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-4 min-w-[320px] max-w-[400px]">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        readyReport ? 'bg-green-50' : 'bg-blue-50'
                    }`}>
                        {readyReport ? (
                            <Check className="h-5 w-5 text-green-600" />
                        ) : (
                            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-semibold ${readyReport ? 'text-green-800' : 'text-gray-900'}`}>
                            {readyReport ? 'Report Ready!' : 'Generating Report...'}
                        </h4>
                        {readyReport ? (
                            <div className="mt-1.5">
                                <p className="text-xs text-gray-500 truncate">{readyReport.fileName}</p>
                                <a
                                    href={readyReport.downloadUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                    <Download className="h-3 w-3" />
                                    Download {readyReport.format}
                                </a>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500 mt-0.5">
                                Your report is being generated in the background. You'll be notified when it's ready.
                            </p>
                        )}
                    </div>

                    {/* Close button */}
                    <button
                        onClick={() => {
                            setVisible(false);
                            onDismiss();
                        }}
                        className="h-6 w-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Progress bar for generating */}
                {!readyReport && (
                    <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                )}
            </div>
        </div>
    );
}
