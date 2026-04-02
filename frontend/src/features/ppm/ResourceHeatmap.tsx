import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Week 1', allocated: 40, actual: 38 },
  { name: 'Week 2', allocated: 40, actual: 45 },
  { name: 'Week 3', allocated: 40, actual: 30 },
  { name: 'Week 4', allocated: 40, actual: 40 },
];

export const ResourceHeatmap = () => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">Resource Utilization Forecast</h3>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="allocated" name="Forecasted Allocation" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="actual" name="Actual Hours Logged" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
