import { useState, useEffect } from 'react';
import { BarChart as BarChartIcon, Activity, Clock, Film, Send, AlertTriangle } from 'lucide-react';
import { apiFetch, errorMessage } from '../api';
import { JOB_TYPE_LABELS } from '../jobs';
import { platformName, type Analytics as AnalyticsData, type JobType } from '../types';

const Bar = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm font-bold text-gray-300 mb-2">
        <span>{label}</span>
        <span>{value} <span className="text-gray-500 font-medium">({percent}%)</span></span>
      </div>
      <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden" role="presentation">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
};

const Analytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<AnalyticsData>('/api/analytics')
      .then(setData)
      .catch(err => setError(errorMessage(err, 'Could not load analytics.')));
  }, []);

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-[70vh] w-full gap-3" role="alert">
        <AlertTriangle className="w-8 h-8 text-red-400" aria-hidden="true" />
        <p className="text-red-400 font-medium">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center items-center h-[70vh] w-full" role="status" aria-label="Loading analytics">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  const kpis = [
    { label: 'Jobs Run', value: data.jobs.total.toLocaleString(), icon: <Activity className="w-5 h-5 text-white" aria-hidden="true" /> },
    { label: 'Clips Generated', value: data.totalClips.toLocaleString(), icon: <Film className="w-5 h-5 text-white" aria-hidden="true" /> },
    { label: 'Avg Virality Score', value: data.avgViralityScore != null ? `${data.avgViralityScore}/100` : '—', icon: <BarChartIcon className="w-5 h-5 text-white" aria-hidden="true" /> },
    { label: 'Hours Processed', value: data.hoursProcessed != null ? `${data.hoursProcessed}h` : '—', icon: <Clock className="w-5 h-5 text-white" aria-hidden="true" /> },
  ];
  const platformEntries = Object.entries(data.platforms);
  const jobTypes = Object.entries(data.jobsByType) as [JobType, number][];

  return (
    <div className="w-full flex flex-col p-8 animate-fade-in-up">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <BarChartIcon className="w-8 h-8 text-white" aria-hidden="true" />
          Analytics Dashboard
        </h1>
        <p className="text-gray-400 font-medium">Processing and publishing results from your jobs. Values that aren't measured are shown as —.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map(kpi => (
          <div key={kpi.label} className="glass-panel p-6 rounded-2xl flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 mb-4">{kpi.icon}</div>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className="text-3xl font-bold text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-6">
          <h3 className="text-lg font-bold text-white">Job Outcomes</h3>
          {data.jobs.total === 0 ? (
            <p className="text-sm text-gray-500">No jobs yet.</p>
          ) : (
            <>
              <Bar label="Completed" value={data.jobs.completed} total={data.jobs.total} color="bg-green-500" />
              <Bar label="Failed" value={data.jobs.failed} total={data.jobs.total} color="bg-red-500" />
              <Bar label="Processing" value={data.jobs.processing} total={data.jobs.total} color="bg-blue-500" />
            </>
          )}
        </div>

        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-6">
          <h3 className="text-lg font-bold text-white">Jobs by Type</h3>
          {jobTypes.length === 0 ? (
            <p className="text-sm text-gray-500">No jobs yet.</p>
          ) : jobTypes.map(([type, count]) => (
            <Bar key={type} label={JOB_TYPE_LABELS[type] ?? type} value={count} total={data.jobs.total} color="bg-white" />
          ))}
        </div>

        <div className="glass-panel p-6 rounded-3xl flex flex-col gap-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Send className="w-4 h-4" aria-hidden="true" /> Publishing</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Published', value: data.posts.uploaded, color: 'text-green-400' },
              { label: 'Scheduled', value: data.posts.scheduled, color: 'text-yellow-400' },
              { label: 'Failed', value: data.posts.failed, color: 'text-red-400' },
            ].map(item => (
              <div key={item.label} className="bg-black/40 rounded-xl p-3 border border-white/5">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{item.label}</p>
              </div>
            ))}
          </div>
          {platformEntries.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing has been published yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="py-2 font-bold">Platform</th>
                  <th className="py-2 font-bold text-right">Uploaded</th>
                  <th className="py-2 font-bold text-right">Failed</th>
                </tr>
              </thead>
              <tbody>
                {platformEntries.map(([platform, counts]) => (
                  <tr key={platform} className="border-t border-white/5">
                    <td className="py-2 text-gray-200 font-semibold">{platformName(platform)}</td>
                    <td className="py-2 text-right text-green-400 font-bold">{counts.uploaded}</td>
                    <td className="py-2 text-right text-red-400 font-bold">{counts.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
