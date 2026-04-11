import { create } from 'zustand';
import { addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';

interface ResourceState {
    dateFrom: string;
    dateTo: string;
    viewMode: 'week' | 'month';
    expandedMembers: Set<string>;
    setDateRange: (from: string, to: string) => void;
    setViewMode: (mode: 'week' | 'month') => void;
    toggleMemberExpand: (userId: string) => void;
}

const getInitialDates = () => {
    // default: current week ± 2 weeks
    const today = new Date();
    const from = subWeeks(startOfWeek(today, { weekStartsOn: 1 }), 2);
    const to = endOfWeek(addWeeks(today, 2), { weekStartsOn: 1 });
    return {
        dateFrom: from.toISOString().split('T')[0],
        dateTo: to.toISOString().split('T')[0]
    };
};

export const useResourceStore = create<ResourceState>((set) => ({
    ...getInitialDates(),
    viewMode: 'week',
    expandedMembers: new Set(),
    setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
    setViewMode: (viewMode) => set({ viewMode }),
    toggleMemberExpand: (userId) => set((state) => {
        const newSet = new Set(state.expandedMembers);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        return { expandedMembers: newSet };
    })
}));
