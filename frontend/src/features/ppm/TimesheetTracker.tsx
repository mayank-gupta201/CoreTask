import { useState } from 'react';
import { Play, Square, Save, Clock, ChevronRight } from 'lucide-react';

export const TimesheetTracker = () => {
  const [tracking, setTracking] = useState(false);

  // Note: True timer interval logic skipped for brevity, focused on UX
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mt-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Clock size={20} className="mr-2 text-indigo-500" />
            Timesheet & Billing
        </h3>
        <button className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center">
            Auto-fill from active tasks <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Timer */}
        <div className="lg:col-span-1 rounded-xl bg-slate-50 border border-slate-100 p-6 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-gray-500 mb-2">Current Session</p>
            <div className="text-4xl font-mono tracking-tighter font-light text-slate-800 mb-6">
                00:00:00
            </div>
            
            <div className="w-full flex space-x-3">
                <button 
                  onClick={() => setTracking(!tracking)} 
                  className={`flex-1 py-2.5 rounded-md font-medium text-white flex items-center justify-center transition-colors ${tracking ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                >
                    {tracking ? <Square size={16} className="mr-2" fill="currentColor" /> : <Play size={16} className="mr-2" fill="currentColor" />}
                    {tracking ? 'Stop Timer' : 'Start Timer'}
                </button>
            </div>
        </div>

        {/* Weekly Log Table */}
        <div className="lg:col-span-2 overflow-x-auto">
            <table className="w-full text-sm text-left align-middle text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50/50">
                    <tr>
                        <th className="px-4 py-3 font-medium">Task / Project</th>
                        <th className="px-4 py-3 font-medium text-right">Duration</th>
                        <th className="px-4 py-3 font-medium text-right">Cost Rate</th>
                        <th className="px-4 py-3 font-medium text-right">Billing Rate</th>
                        <th className="px-4 py-3 font-medium text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    <tr className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">Design System Revamp</p>
                            <p className="text-xs text-gray-400">Project: Alpha Redesign</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">03:45:00</td>
                        <td className="px-4 py-3 text-right">$45/hr</td>
                        <td className="px-4 py-3 text-right">$120/hr</td>
                        <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Logged
                            </span>
                        </td>
                    </tr>
                    <tr className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">Backend API Optimization</p>
                            <p className="text-xs text-gray-400">Project: Core Infrastructure</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">05:10:00</td>
                        <td className="px-4 py-3 text-right">$55/hr</td>
                        <td className="px-4 py-3 text-right">$150/hr</td>
                        <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Approved
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
            
            <div className="mt-4 flex justify-end">
                <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-md text-sm font-medium hover:bg-indigo-100 transition-colors">
                    <Save size={16} />
                    <span>Submit Timesheet</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
