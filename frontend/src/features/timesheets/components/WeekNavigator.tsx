import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, subWeeks } from 'date-fns';

interface WeekNavigatorProps {
    currentWeekStart: string; // ISO String
    onWeekChange: (newWeekStart: string) => void;
}

export const WeekNavigator = ({ currentWeekStart, onWeekChange }: WeekNavigatorProps) => {
    const activeMonday = new Date(currentWeekStart);
    const activeSunday = new Date(activeMonday);
    activeSunday.setDate(activeMonday.getDate() + 6);

    const handlePrev = () => onWeekChange(subWeeks(activeMonday, 1).toISOString());
    const handleNext = () => onWeekChange(addWeeks(activeMonday, 1).toISOString());
    const handleToday = () => {
        const d = new Date();
        const day = d.getDay() || 7; 
        d.setDate(d.getDate() - day + 1);
        d.setHours(0, 0, 0, 0);
        onWeekChange(d.toISOString());
    };

    return (
        <div className="flex items-center space-x-4">
            <button
                onClick={handlePrev}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                title="Previous Week"
            >
                <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <span className="font-semibold text-gray-800 text-sm w-48 text-center">
                {format(activeMonday, 'MMM d')} - {format(activeSunday, 'MMM d, yyyy')}
            </span>
            <button
                onClick={handleNext}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                title="Next Week"
            >
                <ChevronRight size={20} className="text-gray-600" />
            </button>
            <button 
                onClick={handleToday}
                className="text-sm px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
            >
                Today
            </button>
        </div>
    );
};
