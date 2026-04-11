import React, { useState, useEffect, useRef, useCallback } from 'react';

interface TimesheetCellProps {
    initialValue: number | null;
    isReadOnly: boolean;
    onSave: (val: number | null) => void;
    isWeekend?: boolean;
    animateIn?: boolean; // For auto-fill animation
}

export const TimesheetCell = ({ initialValue, isReadOnly, onSave, isWeekend, animateIn }: TimesheetCellProps) => {
    const [localVal, setLocalVal] = useState<string>(initialValue ? initialValue.toString() : '');
    const [isAnimating, setIsAnimating] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevInitialRef = useRef<number | null>(initialValue);

    // Sync external changes (e.g. query invalidation)
    useEffect(() => {
        setLocalVal(initialValue ? initialValue.toString() : '');
        prevInitialRef.current = initialValue;
    }, [initialValue]);

    // Auto-fill pop-in animation
    useEffect(() => {
        if (animateIn && initialValue !== null && prevInitialRef.current !== initialValue) {
            setIsAnimating(true);
            const timer = setTimeout(() => setIsAnimating(false), 500);
            return () => clearTimeout(timer);
        }
    }, [animateIn, initialValue]);

    const debouncedSave = useCallback((rawValue: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            const parsed = parseFloat(rawValue);
            const finalVal = isNaN(parsed) || parsed <= 0 ? null : parsed;

            if (finalVal !== prevInitialRef.current) {
                onSave(finalVal);
            }
        }, 800);
    }, [onSave]);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isReadOnly) return;
        const val = e.target.value;
        setLocalVal(val);
        debouncedSave(val);
    };

    const handleBlur = () => {
        // Flush any pending debounce immediately on blur
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (isReadOnly) return;
        const parsed = parseFloat(localVal);
        const finalVal = isNaN(parsed) || parsed <= 0 ? null : parsed;

        if (finalVal !== prevInitialRef.current) {
            onSave(finalVal);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    };

    if (isReadOnly) {
        return (
            <div className={`h-full w-full flex items-center justify-center text-sm font-medium ${isWeekend ? 'bg-gray-50 text-gray-500' : 'bg-transparent text-gray-800'}`}>
                {initialValue ? initialValue : '—'}
            </div>
        );
    }

    return (
        <input
            type="number"
            step="0.1"
            min="0"
            max="24"
            className={`w-full h-full text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 box-border border-transparent hover:border-gray-300 border transition-all duration-200 ${
                isWeekend ? 'bg-gray-50' : 'bg-white'
            } ${isAnimating ? 'animate-cell-pop bg-green-50' : ''}`}
            value={localVal}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="—"
        />
    );
};
