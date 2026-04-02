import { useEffect, useRef } from 'react';
import Gantt from 'frappe-gantt';

// Ensure generic CSS works
import 'frappe-gantt/dist/frappe-gantt.css'; 
// Note: frappe-gantt type definitions might not exist or might need a generic declare.

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
            if (!ganttInstance.current) {
                ganttInstance.current = new Gantt(ganttRef.current, tasks, {
                    header_height: 50,
                    column_width: 30,
                    step: 24,
                    view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
                    bar_height: 20,
                    bar_corner_radius: 3,
                    arrow_curve: 5,
                    padding: 18,
                    view_mode: 'Day',
                    date_format: 'YYYY-MM-DD',
                    custom_popup_html: null
                });
            }
        } catch (error) {
            console.error("Frappe Gantt Initialization Error", error);
        }

        return () => {
            // Cleanup logic if needed
        };
    }, []);

    return (
        <div className="w-full overflow-x-auto bg-white p-6 rounded-lg shadow-sm border border-gray-100 mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Master Project Roadmap</h3>
            <div className="frappe-gantt-wrapper">
                <div ref={ganttRef} className="w-full" />
            </div>
            
            {/* Custom frail overrides for frappe gantt inside Tailwind */}
            <style>
            {`
                .frappe-gantt-wrapper .gantt .bar-progress { fill: #3b82f6; }
                .frappe-gantt-wrapper .gantt .bar-wrapper.active .bar { fill: #2563eb; }
            `}
            </style>
        </div>
    );
};
