import { useState, useEffect } from 'react';
import { BarChart as BarChartIcon, Activity, Clock, Film, Send, AlertTriangle } from 'lucide-react';
import { apiFetch, errorMessage } from '../api';
import { JOB_TYPE_LABELS } from '../jobs';
import { PageHeader, Panel } from '../components/ui';
import { platformName, type Analytics as AnalyticsData, type JobType } from '../types';

const Bar = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm font-semibold text-[var(--color-ink)] mb-2">
        <span>{label}</span>
        <span>{value} <span className="text-[var(--color-faint)] font-medium">({percent}%)</span></span>
      </div>
      <div className="w-full h-2 bg-[var(--color-canvas)] rounded-full overflow-hidden border border-[var(--color-border)]" role="presentation">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
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
      <div className="page-shell flex flex-col justify-center items-center h-[70vh] w-full gap-3" role="alert">
        <AlertTriangle className="w-8 h-8 text-[var(--color-danger)]" aria-hidden="true" />
        <p className="text-[var(--color-danger)] font-medium">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-shell flex justify-center items-center h-[70vh] w-full" role="status" aria-label="Loading analytics">
        <div className="w-10 h-10 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
      </div>
    );
  }

  const kpis = [
    { label: 'Jobs Run', value: data.jobs.total.toLocaleString(), icon: <Activity className="w-5 h-5 text-[var(--color-muted)]" aria-hidden="true" /> },
    { label: 'Clips Generated', value: data.totalClips.toLocaleString(), icon: <Film className="w-5 h-5 text-[var(--color-muted)]" aria-hidden="true" /> },
    { label: 'Avg Virality Score', value: data.avgViralityScore != null ? `${data.avgViralityScore}/100` : '—', icon: <BarChartIcon className="w-5 h-5 text-[var(--color-muted)]" aria-hidden="true" /> },
    { label: 'Hours Processed', value: data.hoursProcessed != null ? `${data.hoursProcessed}h` : '—', icon: <Clock className="w-5 h-5 text-[var(--color-muted)]" aria-hidden="true" /> },
  ];
  const platformEntries = Object.entries(data.platforms);
  const jobTypes = Object.entries(data.jobsByType) as [JobType, number][];

  return (
    <div className="page-shell animate-fade-in-up max-w-6xl mx-auto">
      <PageHeader
        title="Analytics"
        subtitle="Processing and publishing results from your jobs. Values that aren't measured are shown as —."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map(kpi => (
          <Panel key={kpi.label} className="p-5 flex flex-col">
            <div className="w-9 h-9 rounded-[10px] bg-[var(--color-canvas)] flex items-center justify-center border border-[var(--color-border)] mb-3">{kpi.icon}</div>
            <p className="text-[10px] text-[var(--color-faint)] font-semibold uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className="font-display text-2xl font-bold text-[var(--color-ink)] tracking-tight">{kpi.value}</p>
          </Panel>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel className="p-6 flex flex-col gap-5">
          <h3 className="font-display text-lg font-bold text-[var(--color-ink)]">Job Outcomes</h3>
          {data.jobs.total === 0 ? (
            <p className="text-sm text-[var(--color-faint)]">No jobs yet.</p>
          ) : (
            <>
              <Bar label="Completed" value={data.jobs.completed} total={data.jobs.total} color="bg-[var(--color-ok)]" />
              <Bar label="Failed" value={data.jobs.failed} total={data.jobs.total} color="bg-[var(--color-danger)]" />
              <Bar label="Processing" value={data.jobs.processing} total={data.jobs.total} color="bg-[var(--color-accent)]" />
            </>
          )}
        </Panel>

        <Panel className="p-6 flex flex-col gap-5">
          <h3 className="font-display text-lg font-bold text-[var(--color-ink)]">Jobs by Type</h3>
          {jobTypes.length === 0 ? (
            <p className="text-sm text-[var(--color-faint)]">No jobs yet.</p>
          ) : jobTypes.map(([type, count]) => (
            <Bar key={type} label={JOB_TYPE_LABELS[type] ?? type} value={count} total={data.jobs.total} color="bg-[var(--color-ink)]" />
          ))}
        </Panel>

        <Panel className="p-6 flex flex-col gap-4">
          <h3 className="font-display text-lg font-bold text-[var(--color-ink)] flex items-center gap-2">
            <Send className="w-4 h-4 text-[var(--color-muted)]" aria-hidden="true" /> Publishing
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Published', value: data.posts.uploaded, color: 'text-[var(--color-ok)]' },
              { label: 'Scheduled', value: data.posts.scheduled, color: 'text-[var(--color-warn)]' },
              { label: 'Failed', value: data.posts.failed, color: 'text-[var(--color-danger)]' },
            ].map(item => (
              <div key={item.label} className="bg-[var(--color-canvas)] rounded-[10px] p-3 border border-[var(--color-border)]">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-faint)] font-bold">{item.label}</p>
              </div>
            ))}
          </div>
          {platformEntries.length === 0 ? (
            <p className="text-sm text-[var(--color-faint)]">Nothing has been published yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--color-faint)]">
                  <th className="py-2 font-bold">Platform</th>
                  <th className="py-2 font-bold text-right">Uploaded</th>
                  <th className="py-2 font-bold text-right">Failed</th>
                </tr>
              </thead>
              <tbody>
                {platformEntries.map(([platform, counts]) => (
                  <tr key={platform} className="border-t border-[var(--color-border)]">
                    <td className="py-2 text-[var(--color-ink)] font-semibold">{platformName(platform)}</td>
                    <td className="py-2 text-right text-[var(--color-ok)] font-bold">{counts.uploaded}</td>
                    <td className="py-2 text-right text-[var(--color-danger)] font-bold">{counts.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default Analytics;
