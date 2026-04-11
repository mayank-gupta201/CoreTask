

export const TimesheetStatusBadge = ({ status }: { status: string }) => {
    let bg = 'bg-gray-100 text-gray-800';
    if (status === 'SUBMITTED') bg = 'bg-blue-100 text-blue-800';
    if (status === 'APPROVED') bg = 'bg-green-100 text-green-800';
    if (status === 'REJECTED') bg = 'bg-red-100 text-red-800';

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${bg}`}>
            {status}
        </span>
    );
};
