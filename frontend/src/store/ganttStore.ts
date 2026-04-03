import { create } from 'zustand';

// Assuming gantt-task-react ViewMode type
export type ViewMode = 'Hour' | 'Quarter Day' | 'Half Day' | 'Day' | 'Week' | 'Month' | 'Year';

interface GanttStore {
    zoomLevel: ViewMode;
    criticalPathTaskIds: string[];
    isDragging: boolean;
    setZoomLevel: (zoom: ViewMode) => void;
    setCriticalPath: (taskIds: string[]) => void;
    setIsDragging: (isDragging: boolean) => void;
}

export const useGanttStore = create<GanttStore>((set) => ({
    zoomLevel: 'Week',
    criticalPathTaskIds: [],
    isDragging: false,
    setZoomLevel: (zoom) => set({ zoomLevel: zoom }),
    setCriticalPath: (ids) => set({ criticalPathTaskIds: ids }),
    setIsDragging: (dragging) => set({ isDragging: dragging }),
}));
