import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertCircle, CalendarHeart } from 'lucide-react';

interface GridCellProps {
    date: string;
    totalAllocation: number;
    isHoliday: boolean;
    isOverAllocated: boolean;
    tasks: Array<{ taskId: string; taskTitle: string; allocation: number }>;
}

export function ResourceGridCell({ date, totalAllocation, isHoliday, isOverAllocated, tasks }: GridCellProps) {
    // 0% = white/empty
    // 1-79% = bg-blue-50 (light blue)
    // 80-99% = bg-yellow-50 (light amber, approaching capacity)
    // 100% = bg-green-100 (fully utilized)
    // >100% = bg-red-100 with red text (OVER-ALLOCATED warning)

    const getBgColor = () => {
        if (isHoliday) return 'bg-gray-100';
        if (totalAllocation === 0) return 'bg-white';
        if (totalAllocation > 0 && totalAllocation < 80) return 'bg-blue-50 text-blue-800';
        if (totalAllocation >= 80 && totalAllocation < 100) return 'bg-yellow-50 text-yellow-800';
        if (totalAllocation === 100) return 'bg-green-100 text-green-800';
        if (totalAllocation > 100) return 'bg-red-100 text-red-800 font-bold border border-red-300 shadow-sm';
        return 'bg-white';
    };

    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <div className={cn(
                        "w-full h-full min-h-[44px] flex items-center justify-center text-xs transition-colors cursor-pointer border-r border-b border-border/40 hover:brightness-95",
                        getBgColor()
                    )}>
                        {isHoliday && <CalendarHeart className="h-4 w-4 text-gray-400" />}
                        {!isHoliday && totalAllocation > 0 && (
                            <span className="flex items-center gap-1">
                                {isOverAllocated && <AlertCircle className="h-3 w-3 text-red-600" />}
                                {totalAllocation}%
                            </span>
                        )}
                        {!isHoliday && totalAllocation === 0 && <span className="opacity-0">-</span>}
                    </div>
                </TooltipTrigger>
                <TooltipContent className="w-64 p-3 shadow-lg">
                    <div className="space-y-2">
                        <div className="font-semibold text-sm border-b pb-1 mb-2">{date}</div>
                        {isHoliday ? (
                            <div className="text-muted-foreground text-sm flex items-center gap-2">
                                <CalendarHeart className="h-4 w-4" />
                                Holiday / Weekend
                            </div>
                        ) : tasks.length > 0 ? (
                            <div className="space-y-1.5">
                                {tasks.map((t, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                        <span className="truncate pr-3" title={t.taskTitle}>• {t.taskTitle}</span>
                                        <Badge variant="secondary" className="text-[10px]">{t.allocation}%</Badge>
                                    </div>
                                ))}
                                {isOverAllocated && (
                                    <div className="mt-3 text-xs text-red-500 font-medium pt-2 border-t border-red-100/20">
                                        Warning: Total allocation {totalAllocation}% exceeds capacity limits.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-muted-foreground text-sm">No tasks assigned.</div>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
