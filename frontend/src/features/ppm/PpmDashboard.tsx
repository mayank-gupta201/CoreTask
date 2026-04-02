import { ReactNode } from 'react';
import { ResourceHeatmap } from './ResourceHeatmap';
import { TimesheetTracker } from './TimesheetTracker';
import { GanttChart } from './GanttChart';
import { Clock, Briefcase, AlertTriangle, TrendingUp } from 'lucide-react';

export const PpmDashboard = () => {
  return (
    <div className="flex-1 space-y-6 p-6 bg-gray-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Portfolio & Program Overview</h2>
            <p className="text-sm text-gray-500 mt-1">Enterprise Project Portfolio Management Dashboard</p>
        </div>
        <div className="flex space-x-2">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm">
            + New Program
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Active Portfolios" value="3" icon={<Briefcase size={20} className="text-indigo-500" />} />
        <KpiCard title="Total Capacity Booked" value="84%" icon={<Clock size={20} className="text-orange-500" />} />
        <KpiCard title="Open Risks" value="12" icon={<AlertTriangle size={20} className="text-red-500" />} />
        <KpiCard title="Gross Margin" value="+14.2%" icon={<TrendingUp size={20} className="text-emerald-500" />} />
      </div>

      <TimesheetTracker />

      <div className="grid gap-6 md:grid-cols-1">
        <ResourceHeatmap />
      </div>
      
      <GanttChart />
      
    </div>
  );
};

const KpiCard = ({ title, value, icon }: { title: string, value: string, icon: ReactNode }) => (
  <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    </div>
    <div className="h-12 w-12 rounded-full bg-indigo-50/50 flex items-center justify-center">
      {icon}
    </div>
  </div>
);
