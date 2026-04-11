import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Gantt, Task as GanttTaskType, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { api } from '@/api/axios';
import { ArrowLeft, Loader2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PortfolioRoadmap = () => {
    const { id: portfolioId } = useParams<{ id: string }>();
    const [zoomLevel, setZoomLevel] = useState<ViewMode>(ViewMode.Month);

    // Fetch roadmap specific payload
    const { data: roadmapData, isLoading } = useQuery({
        queryKey: ['portfolio-roadmap', portfolioId],
        queryFn: async () => {
            const res = await api.get(`/portfolios/${portfolioId}/roadmap`);
            return res.data;
        },
        enabled: !!portfolioId,
    });

    const { data: portfolio } = useQuery({
        queryKey: ['portfolio', portfolioId],
        queryFn: async () => {
            const res = await api.get(`/portfolios/${portfolioId}`);
            return res.data;
        },
        enabled: !!portfolioId,
    });

    // Format tasks for the library
    const formattedTasks: GanttTaskType[] = [];

    if (roadmapData) {
        roadmapData.projects.forEach((t: any) => {
             // Basic Project Bar
            formattedTasks.push({
                id: t.id,
                name: `[Project] ${t.name}`,
                type: 'project',
                start: new Date(t.start),
                end: new Date(t.end),
                progress: t.progress,
                styles: {
                    backgroundColor: '#3b82f6', // blue-500
                    progressColor: '#2563eb',   // blue-600
                },
                project: 'project-level-bar' 
            } as GanttTaskType);
        });

        roadmapData.milestones.forEach((m: any) => {
            formattedTasks.push({
                id: m.id,
                name: m.name,
                type: 'milestone',
                start: new Date(m.start),
                end: new Date(m.end),
                progress: m.isComplete ? 100 : 0,
                project: m.project, // Associates milestone with the project bar visually if configured
                styles: {
                    backgroundColor: '#8b5cf6', // violet-500
                }
            } as GanttTaskType);
        });
    }

    if (isLoading) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-6 text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Loading Portfolio Roadmap...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-4 p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center sm:flex-row flex-col gap-3 pb-4 border-b">
                <div className="flex items-center space-x-4">
                     <Link to={`/portfolios/${portfolioId}`} className="text-gray-400 hover:text-gray-700">
                         <ArrowLeft size={20} />
                     </Link>
                     <div>
                         <h1 className="text-xl font-semibold tracking-tight focus-visible:outline-none flex items-center gap-2 text-gray-900">
                             <Calendar className="h-5 w-5 text-gray-700" />
                             {portfolio?.name || 'Loading...'} Roadmap
                         </h1>
                         <p className="text-sm text-gray-500 mt-0.5 tracking-tight">
                             Strategic project timelines and milestones across programs.
                         </p>
                     </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-gray-100 p-0.5 rounded-lg border flex text-xs">
                        {[ViewMode.Week, ViewMode.Month, ViewMode.Year].map(zoom => (
                            <button
                                key={zoom}
                                onClick={() => setZoomLevel(zoom)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md transition-all font-medium",
                                    zoomLevel === zoom ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-black"
                                )}
                            >
                                {zoom}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border bg-white w-full shadow-sm relative min-h-[500px]">
                {formattedTasks.length > 0 ? (
                    <Gantt
                        tasks={formattedTasks}
                        viewMode={zoomLevel}
                        onDateChange={() => {}}
                        listCellWidth={window.innerWidth < 768 ? "" : "220px"}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        No projects or tasks found in this portfolio yet. Map projects to programs first.
                    </div>
                )}
            </div>
        </div>
    );
};
