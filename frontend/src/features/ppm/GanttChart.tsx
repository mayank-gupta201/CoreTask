import { useEffect, useRef } from 'react';
import Gantt from 'frappe-gantt';

// Ensure generic CSS works
import 'frappe-gantt/dist/frappe-gantt.css'; 

export const GanttChart = () => {
    const ganttRef = useRef<HTMLDivElement>(null);
    const ganttInstance = useRef<any>(null);

    useEffect(() => {
        if (!ganttRef.current) return;

        const tasks = [
            {
                id: 'Project 1',
                name: 'Redesign UI',
                start: '2026-04-01',
                end: '2026-04-10',
                progress: 20,
                dependencies: ''
            },
            {
                id: 'Project 2',
                name: 'Backend API Migration',
                start: '2026-04-05',
                end: '2026-04-15',
                progress: 10,
                dependencies: 'Project 1'
            },
            {
                id: 'Project 3',
                name: 'Phase 3: Testing',
                start: '2026-04-12',
                end: '2026-04-20',
                progress: 0,
                dependencies: 'Project 2'
            }
        ];

        try {
            // Destroy existing instance to avoid duplicates on re-render
            if (ganttInstance.current) {
                ganttRef.current.innerHTML = '';
                ganttInstance.current = null;
            }

            ganttInstance.current = new Gantt(ganttRef.current, tasks, {
                header_height: 56,
                column_width: 60,
                step: 24,
                view_modes: ['Day', 'Week', 'Month'],
                bar_height: 24,
                bar_corner_radius: 6,
                arrow_curve: 5,
                padding: 22,
                view_mode: 'Week',
                date_format: 'YYYY-MM-DD',
                custom_popup_html: (task: any) => {
                    return `
                        <div style="padding: 12px 16px; font-family: system-ui, sans-serif; min-width: 180px;">
                            <h5 style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #1e293b;">${task.name}</h5>
                            <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                                ${task.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${task.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </p>
                            <div style="margin-top: 8px; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                                <div style="height: 100%; width: ${task.progress}%; background: #3b82f6; border-radius: 2px;"></div>
                            </div>
                            <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8;">${task.progress}% complete</p>
                        </div>
                    `;
                }
            });
        } catch (error) {
            console.error("Frappe Gantt Initialization Error", error);
        }

        return () => {
            if (ganttRef.current) {
                ganttRef.current.innerHTML = '';
            }
            ganttInstance.current = null;
        };
    }, []);

    return (
        <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 mt-6 overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Master Project Roadmap</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Timeline view of all programs and projects</p>
                </div>
            </div>
            <div className="gantt-chart-container overflow-x-auto overflow-y-hidden w-full px-2 pb-4" style={{ minHeight: '220px' }}>
                <div ref={ganttRef} className="w-full" />
            </div>
            
            {/* Clean style overrides for frappe-gantt inside the app design system */}
            <style>
            {`
                /* ——— Grid & Header ——— */
                .gantt-chart-container .gantt .grid-header {
                    fill: #f8fafc;
                    stroke: #e2e8f0;
                }
                .gantt-chart-container .gantt .grid-row {
                    fill: #ffffff;
                }
                .gantt-chart-container .gantt .grid-row:nth-child(even) {
                    fill: #f8fafc;
                }
                .gantt-chart-container .gantt .row-line {
                    stroke: #f1f5f9;
                }
                .gantt-chart-container .gantt .tick {
                    stroke: #f1f5f9;
                    stroke-dasharray: none;
                }

                /* ——— Date labels ——— */
                .gantt-chart-container .gantt .lower-text,
                .gantt-chart-container .gantt .upper-text {
                    font-size: 11px;
                    font-family: system-ui, -apple-system, sans-serif;
                    fill: #94a3b8;
                    font-weight: 500;
                }
                .gantt-chart-container .gantt .upper-text {
                    font-size: 12px;
                    fill: #64748b;
                    font-weight: 600;
                }

                /* ——— Task bars ——— */
                .gantt-chart-container .gantt .bar {
                    fill: #93c5fd;
                    rx: 6;
                    ry: 6;
                }
                .gantt-chart-container .gantt .bar-progress {
                    fill: #3b82f6;
                    rx: 6;
                    ry: 6;
                }
                .gantt-chart-container .gantt .bar-wrapper:hover .bar {
                    fill: #60a5fa;
                }
                .gantt-chart-container .gantt .bar-wrapper.active .bar {
                    fill: #60a5fa;
                }
                .gantt-chart-container .gantt .bar-label {
                    font-size: 11px;
                    font-family: system-ui, -apple-system, sans-serif;
                    font-weight: 500;
                    fill: #1e293b;
                }

                /* ——— Dependency arrows ——— */
                .gantt-chart-container .gantt .arrow {
                    stroke: #cbd5e1;
                    stroke-width: 1.5;
                }

                /* ——— Today marker ——— */
                .gantt-chart-container .gantt .today-highlight {
                    fill: #3b82f6;
                    opacity: 0.06;
                }

                /* ——— Popup ——— */
                .gantt-chart-container .gantt .popup-wrapper {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
                }

                /* ——— Scrollbar styling ——— */
                .gantt-chart-container::-webkit-scrollbar {
                    height: 8px;
                }
                .gantt-chart-container::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 4px;
                }
                .gantt-chart-container::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .gantt-chart-container::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }

                /* ——— Handle (drag) circles ——— */
                .gantt-chart-container .gantt .handle {
                    fill: #3b82f6;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .gantt-chart-container .gantt .bar-wrapper:hover .handle {
                    opacity: 1;
                }
            `}
            </style>
        </div>
    );
};
