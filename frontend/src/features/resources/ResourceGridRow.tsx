import { useMemo } from 'react';
import { ChevronDown, ChevronRight, UserCircle } from 'lucide-react';
import { ResourceGridCell } from './ResourceGridCell';
import { ResourceTaskRow } from './ResourceTaskRow';

interface ResourceGridRowProps {
    user: { id: string; name: string; email: string };
    dailyData: any[]; // Array of daily allocation boundaries
    dates: Date[];
    isExpanded: boolean;
    onToggleExpand: (userId: string) => void;
}

export function ResourceGridRow({ user, dailyData, dates, isExpanded, onToggleExpand }: ResourceGridRowProps) {
    // Collect all unique tasks for this user in this date range to render the sub-rows
    const uniqueTasks = useMemo(() => {
        const tasksMap = new Map<string, { taskId: string; taskTitle: string; maxAllocation: number }>();
        dailyData.forEach(day => {
            if (day.tasks && Array.isArray(day.tasks)) {
                day.tasks.forEach((t: any) => {
                    if (!tasksMap.has(t.taskId)) {
                        tasksMap.set(t.taskId, { taskId: t.taskId, taskTitle: t.taskTitle, maxAllocation: t.allocation });
                    } else {
                        // Keep track of the highest allocation they had for this task to show in the sub-row header
                        const existing = tasksMap.get(t.taskId)!;
                        if (t.allocation > existing.maxAllocation) {
                            tasksMap.set(t.taskId, { ...existing, maxAllocation: t.allocation });
                        }
                    }
                });
            }
        });
        return Array.from(tasksMap.values());
    }, [dailyData]);

    // Average or total weekly hours can be estimated by looking at base allocations
    // We just show a summary count of unique tasks right now
    const taskCount = uniqueTasks.length;

    return (
        <>
            <tr className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
                {/* Frozen Left Column: User Profile */}
                <td className="sticky left-0 z-20 bg-card group-hover:bg-muted/30 p-3 border-r border-border/40 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-[250px] min-w-[250px]">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => onToggleExpand(user.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                            disabled={taskCount === 0}
                        >
                            {taskCount > 0 ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <div className="w-5" />}
                        </button>
                        
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <UserCircle className="h-5 w-5 text-primary" />
                        </div>
                        
                        <div className="flex flex-col overflow-hidden">
                            <span className="font-medium text-sm truncate">{user.name}</span>
                            <span className="text-[11px] text-muted-foreground truncate">{taskCount} active task{taskCount !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </td>

                {/* Day Cells Mapping */}
                {dates.map((d) => {
                    const dateStr = d.toISOString().split('T')[0];
                    const dayData = dailyData.find(dd => dd.date === dateStr);
                    
                    return (
                        <td key={dateStr} className="p-0 border-r border-border/20 min-w-[50px]">
                            {dayData ? (
                                <ResourceGridCell 
                                    date={dateStr}
                                    totalAllocation={dayData.totalAllocation}
                                    isHoliday={dayData.isHoliday}
                                    isOverAllocated={dayData.isOverAllocated}
                                    tasks={dayData.tasks}
                                />
                            ) : (
                                <div className="w-full h-full min-h-[44px] bg-white border-b border-border/40"></div> // Fallback blank
                            )}
                        </td>
                    );
                })}
            </tr>

            {/* Expanded Task Sub-rows */}
            {isExpanded && uniqueTasks.map(task => (
                <ResourceTaskRow 
                    key={task.taskId}
                    taskId={task.taskId}
                    taskName={task.taskTitle}
                    totalAllocationForTask={task.maxAllocation}
                    dailyData={dailyData}
                    dates={dates}
                />
            ))}
        </>
    );
}
