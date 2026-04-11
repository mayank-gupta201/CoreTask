import { Badge } from '@/components/ui/badge';

interface ResourceTaskRowProps {
    taskName: string;
    taskId: string;
    totalAllocationForTask: number;
    dailyData: any[]; // The same daily data mapping but filtered/computed only for this task
    dates: Date[];
}

export function ResourceTaskRow({ taskName, taskId, totalAllocationForTask, dailyData, dates }: ResourceTaskRowProps) {
    return (
        <tr className="border-b border-border/40 bg-muted/20 text-sm">
            {/* Frozen Left Column: Indented Task Info */}
            <td className="sticky left-0 z-10 bg-muted/60 pl-10 pr-4 py-2 border-r border-border/40 max-w-[250px]">
                <div className="flex flex-col gap-1">
                    <span className="truncate text-xs font-semibold text-muted-foreground">{taskName}</span>
                    <Badge variant="outline" className="w-fit text-[10px] bg-background">
                        {totalAllocationForTask}% alloc
                    </Badge>
                </div>
            </td>

            {/* Dynamic Day Cells for this specific task */}
            {dates.map((d) => {
                const dateStr = d.toISOString().split('T')[0];
                const dayData = dailyData.find(dd => dd.date === dateStr);
                const taskInDay = dayData?.tasks.find((t: any) => t.taskId === taskId);
                
                const allocationStr = taskInDay ? taskInDay.allocation : 0;
                
                return (
                    <td key={dateStr} className="p-0 border-r border-border/20 min-w-[50px] bg-muted/20">
                        {/* We don't need full ResourceGridCell here because it's just meant for total accumulation visualization.
                            Just a simple box showing the allocation for this task explicitly on this day. 
                         */}
                         <div className="w-full h-full min-h-[36px] flex items-center justify-center text-[11px] text-muted-foreground">
                            {allocationStr > 0 ? `${allocationStr}%` : '-'}
                         </div>
                    </td>
                );
            })}
        </tr>
    );
}
