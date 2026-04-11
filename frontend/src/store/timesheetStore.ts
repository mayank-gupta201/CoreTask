import { create } from 'zustand';

interface TimesheetState {
    currentWeekStart: string; // ISO string 
    draftEdits: Record<string, { hours?: number, notes?: string }>;
    isSaving: boolean;
    setWeek: (weekStart: string) => void;
    setDraftEdit: (logId: string, data: { hours?: number, notes?: string }) => void;
    clearDraftEdit: (logId: string) => void;
    setIsSaving: (isSaving: boolean) => void;
}

// Get the Monday of the current week natively
const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay() || 7; 
    date.setDate(date.getDate() - day + 1);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
};

export const useTimesheetStore = create<TimesheetState>((set) => ({
    currentWeekStart: getMonday(new Date()),
    draftEdits: {},
    isSaving: false,
    setWeek: (weekStart) => set({ currentWeekStart: weekStart }),
    setDraftEdit: (logId, data) => set((state) => ({ 
        draftEdits: { ...state.draftEdits, [logId]: { ...state.draftEdits[logId], ...data } } 
    })),
    clearDraftEdit: (logId) => set((state) => {
        const { [logId]: removed, ...rest } = state.draftEdits;
        return { draftEdits: rest };
    }),
    setIsSaving: (isSaving) => set({ isSaving })
}));
