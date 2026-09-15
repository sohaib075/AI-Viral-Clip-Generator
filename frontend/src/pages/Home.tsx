import { useState, useEffect } from 'react';
import { UploadCloud, Link as LinkIcon, Clock, Video, Activity, Play, AlertTriangle, X, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, errorMessage } from '../api';
import { timeAgo } from '../utils';
import { jobLink, statusBadgeClass } from '../jobs';
import { PageHeader, Panel } from '../components/ui';
import type { Analytics, JobSummary } from '../types';

const Home = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [layout, setLayout] = useState('vertical');
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobSummary[]>([]);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    Promise.all([apiFetch<Analytics>('/api/analytics'), apiFetch<JobSummary[]>('/api/jobs')])
      .then(([analyticsData, jobs]) => {
        setAnalytics(analyticsData);
        setRecentJobs(jobs.slice(0, 5));
      })
      .catch((err) => setDashboardError(errorMessage(err, 'Could not load your dashboard.')));
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!videoUrl && !file) return;

    if (videoUrl && !file) {
      try {
        const { protocol } = new URL(videoUrl);
        if (protocol !== 'http:' && protocol !== 'https:') throw new Error();
      } catch {
        setErrorMsg('Enter a valid HTTP or HTTPS URL.');
        return;
      }
    }

    setSubmitting(true);
    try {
      let body: FormData | string;
      if (file) {
        const formData = new FormData();
        formData.append('video', file);
        formData.append('layout', layout);
        body = formData;
      } else {
        body = JSON.stringify({ videoUrl, layout });
      }

      const data = await apiFetch<{ jobId: string }>('/api/jobs', { method: 'POST', body });
      navigate(`/processing/${data.jobId}`);
    } catch (error) {
      setErrorMsg(errorMessage(error, 'Failed to submit the job.'));
    } finally {
      setSubmitting(false);
    }
  };

  const stats = [
    {
      label: 'Clips generated',
      value: analytics ? analytics.totalClips.toLocaleString() : '—',
      detail: analytics ? `${analytics.jobs.completed} completed job${analytics.jobs.completed === 1 ? '' : 's'}` : '—',
    },
    {
      label: 'Hours processed',
      value: analytics?.hoursProcessed != null ? `${analytics.hoursProcessed}h` : '—',
      detail: 'Source video length',
    },
    {
      label: 'Avg. virality',
      value: analytics?.avgViralityScore != null ? `${analytics.avgViralityScore}` : '—',
      detail: 'AI score / 100',
    },
  ];

  return (
    <div className="page-shell animate-fade-in-up max-w-6xl mx-auto">
      <PageHeader
        title="Create viral clips"
        subtitle="Paste a link or upload a video. We’ll find highlights, burn captions, and get them ready to publish."
      />

      {dashboardError && (
        <div className="alert-error mb-6" role="alert">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          {dashboardError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        <Panel className="lg:col-span-3 p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold text-[var(--color-ink)] mb-6">New clip job</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <div className="alert-error" role="alert">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                {errorMsg}
              </div>
            )}

            <div>
              <label htmlFor="video-url" className="field-label">
                <span className="inline-flex items-center gap-1.5"><LinkIcon className="w-3 h-3" aria-hidden="true" /> Video URL</span>
              </label>
              <input
                id="video-url"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={Boolean(file)}
                placeholder={file ? 'Remove the file to use a URL' : 'https://www.youtube.com/watch?v=...'}
                className="field-input"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[var(--color-border)]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-faint)]">or</span>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>

            <div
              className={`relative flex flex-col items-center justify-center p-7 border border-dashed rounded-[10px] transition-colors cursor-pointer
                ${dragActive
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                  : 'border-[var(--color-border-strong)] bg-[var(--color-canvas)] hover:border-[var(--color-muted)]'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                id="file-upload"
                type="file"
                aria-label="Choose a video file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                accept="video/*"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setVideoUrl(''); }}
              />
              <UploadCloud className="w-6 h-6 text-[var(--color-muted)] mb-2" aria-hidden="true" />
              <p className="text-sm font-medium text-[var(--color-ink)]">{file ? file.name : 'Drop a video here'}</p>
              <p className="text-xs text-[var(--color-faint)] mt-1">
                {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : 'MP4 or MOV · up to 2 GB'}
              </p>
              {file && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="relative z-20 mt-3 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" aria-hidden="true" /> Remove
                </button>
              )}
            </div>

            <fieldset>
              <legend className="field-label">
                <span className="inline-flex items-center gap-1.5"><Video className="w-3 h-3" aria-hidden="true" /> Output format</span>
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'vertical', title: '9:16 Vertical', subtitle: 'TikTok · Reels · Shorts' },
                  { id: 'horizontal', title: '16:9 Landscape', subtitle: 'YouTube · web' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={layout === option.id}
                    onClick={() => setLayout(option.id)}
                    className={`py-3 px-3 rounded-[10px] border text-left transition-colors
                      ${layout === option.id
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                        : 'border-[var(--color-border)] bg-[var(--color-canvas)] hover:border-[var(--color-border-strong)]'}`}
                  >
                    <span className="block text-sm font-semibold text-[var(--color-ink)]">{option.title}</span>
                    <span className="block text-[11px] text-[var(--color-faint)] mt-0.5">{option.subtitle}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <button type="submit" disabled={(!videoUrl && !file) || submitting} className="btn-primary w-full py-3.5">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Play className="w-4 h-4 fill-current" aria-hidden="true" />}
              {submitting ? (file ? 'Uploading…' : 'Starting…') : 'Generate clips'}
            </button>

            <p className="text-[11px] text-[var(--color-faint)] leading-relaxed flex gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              Only process content you have rights to use. Copyright compliance is your responsibility.
            </p>
          </form>
        </Panel>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-3">
            {stats.map((stat) => (
              <Panel key={stat.label} className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">{stat.label}</p>
                <p className="font-display text-2xl font-bold text-[var(--color-ink)] mt-1 tracking-tight">{stat.value}</p>
                <p className="text-[11px] text-[var(--color-faint)] mt-1 truncate">{stat.detail}</p>
              </Panel>
            ))}
          </div>

          <Panel className="p-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-bold text-[var(--color-ink)]">Recent jobs</h3>
              <Link to="/projects" className="btn-ghost text-xs !px-2 !py-1">View all</Link>
            </div>

            <div className="flex-1 flex flex-col gap-2">
              {recentJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--color-faint)]">
                  <Activity className="w-5 h-5 mb-2 opacity-60" aria-hidden="true" />
                  <p className="text-sm">No jobs yet</p>
                </div>
              ) : (
                recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    to={jobLink(job)}
                    className="p-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-canvas)] hover:border-[var(--color-border-strong)] transition-colors block"
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="font-medium text-sm text-[var(--color-ink)] truncate" title={job.title}>{job.title}</span>
                      <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${statusBadgeClass(job.status)}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[var(--color-faint)]">
                      <span className="inline-flex items-center gap-1">
                        {job.status === 'Failed' ? 'View details' : (
                          <><Video className="w-3 h-3" aria-hidden="true" /> {job.clips} clip{job.clips === 1 ? '' : 's'}</>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" aria-hidden="true" /> {timeAgo(job.createdAt)}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default Home;
