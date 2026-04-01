import * as React from "react"

import { cn } from "@/lib/utils"

// A simplified generic Sheet/Modal implementation without Radix Dialog for brevity
// that accepts a boolean 'open' and an onClose handler
export interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
    open: boolean
    onClose: () => void
}

export function Sheet({ open, onClose, children, className }: SheetProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-all duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in"
                onClick={onClose}
            />
            {/* Content */}
            <div
                className={cn(
                    "z-50 w-full md:w-3/4 max-w-sm h-full border-l bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm overflow-y-auto",
                    className
                )}
            >
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                >
                    Close
                    <span className="sr-only">Close</span>
                </button>
                {children}
            </div>
        </div>
    )
}
