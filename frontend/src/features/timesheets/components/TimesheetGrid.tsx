import { useState } from 'react';
import { TimesheetCell } from './TimesheetCell';
import { AddTaskToTimesheetDialog } from './AddTaskToTimesheetDialog';
import { Plus } from 'lucide-react';
import { addDays, format } from 'date-fns';

interface TimesheetGridProps {
    weekStart: string;
    timesheet: any; // backend timesheet DTO
    onLogTime: (taskId: string | null, date: string, hours: number) => void;
    onUpdateLog: (logId: string, hours: number | null) => void;
    isAutoFillAnimating?: boolean; // true right after auto-fill completes
}

export const TimesheetGrid = ({ weekStart, timesheet, onLogTime, onUpdateLog, isAutoFillAnimating }: TimesheetGridProps) => {
    const monday = new Date(weekStart);
    const days = Array.from({ length: 7 }).map((_, i) => {
        const d = addDays(monday, i);
        return {
            dateStr: format(d, 'yyyy-MM-dd'),
            label: format(d, 'EEE'), // Mon, Tue...
            dateNum: format(d, 'd'),
            isWeekend: d.getDay() === 0 || d.getDay() === 6
        };
    });

    const isReadOnly = timesheet?.status === 'SUBMITTED' || timesheet?.status === 'APPROVED';
    const logs = timesheet?.timeLogs || [];

    // Local blank rows (tasks added via "Add Time" but no logs yet)
    const [blankRows, setBlankRows] = useState<Array<{ taskId: string | null; taskLabel: string }>>([]);

    // Group logs by task ID
    const rowsMap = new Map<string, { taskId: string | null, taskLabel: string, logsByDate: Record<string, any> }>();
    
    logs.forEach((log: any) => {
        const key = log.taskId || 'unassigned';
        if (!rowsMap.has(key)) {
            rowsMap.set(key, {
                taskId: log.taskId,
                taskLabel: log.task?.title || 'Unassigned Time',
                logsByDate: {}
            });
        }
        rowsMap.get(key)!.logsByDate[log.logDate] = log;
    });

    const rows = Array.from(rowsMap.values());

    // Merge blank rows that don't already have logs
    const existingTaskIds = new Set(rows.map(r => r.taskId || 'unassigned'));
    const mergedBlankRows = blankRows.filter(br => !existingTaskIds.has(br.taskId || 'unassigned'));

    const allRows = [
        ...rows,
        ...mergedBlankRows.map(br => ({
            taskId: br.taskId,
            taskLabel: br.taskLabel,
            logsByDate: {} as Record<string, any>
        }))
    ];

    // Compute column daily totals
    const dailyTotals = days.map(d => {
        let total = 0;
        allRows.forEach(row => {
            if (row.logsByDate[d.dateStr]) total += parseFloat(row.logsByDate[d.dateStr].hours);
        });
        return total;
    });

    const handleAddRow = (taskId: string | null, taskLabel: string) => {
        const key = taskId || 'unassigned';
        if (existingTaskIds.has(key) || blankRows.some(br => (br.taskId || 'unassigned') === key)) {
            return; // Already exists
        }
        setBlankRows(prev => [...prev, { taskId, taskLabel }]);
    };

    return (
        <div className="bg-white border rounded shadow-sm overflow-x-auto w-full">
            <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                <thead>
                    <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="w-1/4 p-4 font-semibold text-gray-700">Project / Task</th>
                        {days.map((day) => (
                            <th key={day.dateStr} className={`w-24 p-3 border-l text-center ${day.isWeekend ? 'bg-gray-100' : ''}`}>
                                <div>{day.label}</div>
                                <div className="text-gray-900 text-sm mt-1">{day.dateNum}</div>
                            </th>
                        ))}
                        <th className="w-24 p-3 border-l text-center">Total</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {allRows.map((row, idx) => {
                        let rowTotal = 0;
                        return (
                            <tr key={row.taskId || `unassigned-${idx}`} className="border-b group hover:bg-gray-50">
                                <td className="p-4 truncate border-r text-gray-700 font-medium">
                                    {row.taskLabel}
                                </td>
                                {days.map((day, dayIdx) => {
                                    const log = row.logsByDate[day.dateStr];
                                    const hours = log ? parseFloat(log.hours) : null;
                                    if (hours) rowTotal += hours;

                                    return (
                                        <td key={day.dateStr} className={`p-0 border-r h-12 transition-colors ${day.isWeekend ? 'bg-gray-50' : ''}`}
                                            style={isAutoFillAnimating ? { animationDelay: `${(idx * 7 + dayIdx) * 40}ms` } : undefined}
                                        >
                                            <TimesheetCell
                                                isWeekend={day.isWeekend}
                                                initialValue={hours}
                                                isReadOnly={isReadOnly}
                                                animateIn={isAutoFillAnimating}
                                                onSave={(val) => {
                                                    if (log && val === null) {
                                                        // Request delete
                                                        onUpdateLog(log.id, null);
                                                    } else if (log && val !== null) {
                                                        onUpdateLog(log.id, val);
                                                    } else if (!log && val !== null) {
                                                        onLogTime(row.taskId, day.dateStr, val);
                                                    }
                                                }}
                                            />
                                        </td>
                                    );
                                })}
                                <td className="p-3 text-center bg-gray-50 font-bold border-l">
                                    {rowTotal.toFixed(1)}
                                </td>
                            </tr>
                        );
                    })}

                    {/* ADD ROW TRIGGER */}
                    {!isReadOnly && (
                        <tr className="border-b hover:bg-gray-50">
                            <td className="p-3 text-blue-600 font-medium cursor-pointer" colSpan={1}>
                                <AddTaskToTimesheetDialog onAddRow={handleAddRow}>
                                    <div className="flex items-center hover:underline w-max">
                                        <Plus size={16} className="mr-1" />
                                        Add Time
                                    </div>
                                </AddTaskToTimesheetDialog>
                            </td>
                            {/* Empty Placeholders */}
                            {Array.from({ length: 8 }).map((_, i) => (
                                <td key={`empty-${i}`} className="p-3 border-l bg-gray-50/50"></td>
                            ))}
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-100 font-bold border-t-2">
                        <td className="p-4 text-right">Daily Totals</td>
                        {dailyTotals.map((tot, idx) => (
                            <td key={idx} className="p-3 text-center border-l border-gray-200">
                                {tot > 0 ? tot.toFixed(1) : '0.0'}
                            </td>
                        ))}
                        <td className="p-3 text-center border-l border-gray-200 text-blue-800">
                            {dailyTotals.reduce((a,b)=>a+b,0).toFixed(1)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};
