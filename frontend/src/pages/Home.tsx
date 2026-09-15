import { useState, useEffect } from 'react';
import { UploadCloud, Link as LinkIcon, Sparkles, Clock, Video, Activity, Play, AlertTriangle, X, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, errorMessage } from '../api';
import { timeAgo } from '../utils';
import { jobLink, statusBadgeClass } from '../jobs';
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
        setRecentJobs(jobs.slice(0, 4)); // Only show top 4 recent jobs
      })
      .catch((err) => setDashboardError(errorMessage(err, 'Could not load your dashboard.')));
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
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
        setErrorMsg('Invalid URL. Please enter a valid HTTP/HTTPS URL.');
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
    { label: 'Total Clips', value: analytics ? analytics.totalClips.toLocaleString() : '—', icon: <Video className="w-5 h-5 text-gray-200" aria-hidden="true" />,
      note: analytics ? `From ${analytics.jobs.completed} completed job${analytics.jobs.completed === 1 ? '' : 's'}` : '' },
    { label: 'Hours Processed', value: analytics?.hoursProcessed != null ? `${analytics.hoursProcessed}h` : '—', icon: <Clock className="w-5 h-5 text-gray-200" aria-hidden="true" />,
      note: 'Length of the source videos' },
    { label: 'Avg. Virality', value: analytics?.avgViralityScore != null ? `${analytics.avgViralityScore}/100` : '—', icon: <Activity className="w-5 h-5 text-gray-200" aria-hidden="true" />,
      note: 'AI score across generated clips' },
  ];

  return (
    <div className="w-full flex flex-col p-8 lg:p-10 animate-fade-in-up">

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Project Overview</h1>
        <p className="text-gray-400 font-medium">Welcome back. Manage and automate your video pipeline.</p>
      </div>

      {dashboardError && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4" aria-hidden="true" /> {dashboardError}
        </div>
      )}

      {/* Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {stats.map(stat => (
          <div key={stat.label} className="glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden group hover:border-white/20 transition-all duration-300">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all"></div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">{stat.icon}</div>
              <div>
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">{stat.label}</p>
                <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
              </div>
            </div>
            {stat.note && <p className="text-[11px] font-medium text-gray-500">{stat.note}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Widget (Span 2) */}
        <div className="lg:col-span-2 relative animate-slide-up" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>

          <div className="relative glass-panel rounded-3xl p-8 overflow-hidden transition-all duration-500">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                <Sparkles className="w-4 h-4 text-white" aria-hidden="true" />
                New Extraction Job
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              <div className="space-y-2 group">
                {errorMsg && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm font-medium mb-4 flex items-center gap-2" role="alert">
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {errorMsg}
                  </div>
                )}
                <label htmlFor="video-url" className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <LinkIcon className="w-3 h-3" aria-hidden="true" />
                  YouTube or Web URL
                </label>
                <input
                  id="video-url"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  disabled={Boolean(file)}
                  placeholder={file ? 'Remove the selected file to use a URL' : 'https://www.youtube.com/watch?v=...'}
                  className={`w-full px-4 py-3 bg-black/40 border ${errorMsg ? 'border-red-500/50' : 'border-white/10'} rounded-xl focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40 transition-all duration-300 placeholder:text-gray-600 text-white shadow-inner text-sm disabled:opacity-50`}
                />
              </div>

              <div className="flex items-center gap-4 py-2">
                <div className="flex-1 h-[1px] bg-white/5"></div>
                <span className="text-[10px] font-bold text-gray-600 tracking-widest uppercase">OR</span>
                <div className="flex-1 h-[1px] bg-white/5"></div>
              </div>

              <div
                className={`relative flex flex-col items-center justify-center p-8 border border-dashed rounded-xl transition-all duration-300 ease-out cursor-pointer group overflow-hidden
                  ${dragActive ? "border-white bg-white/5 scale-[1.01]" : "border-white/20 bg-black/20 hover:border-white/40 hover:bg-white/[0.03]"}`}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              >
                <input id="file-upload" type="file" aria-label="Choose a video file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="video/*" onChange={(e) => { setFile(e.target.files?.[0] || null); setVideoUrl(''); }} />
                <div className="bg-white/5 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform duration-300 border border-white/10">
                  <UploadCloud className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" aria-hidden="true" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-200 mb-1">{file ? file.name : "Drag & drop file"}</p>
                  <p className="text-[11px] text-gray-500 font-medium">{file ? `${(file.size / (1024*1024)).toFixed(2)} MB` : "MP4, MOV up to 2GB"}</p>
                </div>
                {file && (
                  <button type="button" onClick={() => setFile(null)} className="relative z-20 mt-3 text-xs font-semibold text-gray-300 hover:text-white flex items-center gap-1">
                    <X className="w-3 h-3" aria-hidden="true" /> Remove file
                  </button>
                )}
              </div>

              {/* Target Format Layout Selector */}
              <fieldset className="space-y-3">
                <legend className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                  <Video className="w-3 h-3" aria-hidden="true" />
                  Target Video Format
                </legend>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'vertical', title: '9:16 Vertical', subtitle: 'TikTok / Reels / Shorts' },
                    { id: 'horizontal', title: '16:9 Horizontal', subtitle: 'Landscape / Standard Web' },
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={layout === option.id}
                      onClick={() => setLayout(option.id)}
                      className={`py-3 px-4 rounded-xl border text-sm flex flex-col items-center justify-center gap-1 transition-all duration-300
                        ${layout === option.id
                          ? 'border-white bg-white text-black shadow-lg'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/30 hover:text-gray-200'}`}
                    >
                      <span className="text-sm font-bold">{option.title}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${layout === option.id ? 'text-gray-700' : 'text-gray-500'}`}>{option.subtitle}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <button type="submit" disabled={(!videoUrl && !file) || submitting} className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] disabled:opacity-50 disabled:cursor-not-allowed mt-4">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Play className="w-4 h-4 fill-current" aria-hidden="true" />}
                <span>{submitting ? (file ? 'Uploading...' : 'Starting...') : 'Process Video Pipeline'}</span>
              </button>

              <div className="mt-4 p-4 border border-white/5 rounded-xl flex gap-3 items-start bg-white/[0.01]">
                <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
                  <strong>Guidelines:</strong> Clips are formatted for social media. Ensure you use properly licensed content. Copyright compliance depends entirely on the source content.
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Recent Jobs Table / List (Span 1) */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col h-full animate-slide-up" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
          <h3 className="text-base font-bold text-white tracking-tight mb-6">Recent Jobs</h3>

          <div className="flex-1 flex flex-col gap-3">
            {recentJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 py-10">
                <Activity className="w-6 h-6 mb-2 opacity-50" aria-hidden="true" />
                <p className="text-sm font-medium">No recent jobs found</p>
              </div>
            ) : (
              recentJobs.map((job) => (
                <Link key={job.id} to={jobLink(job)} className="p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-all group block">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-semibold text-sm text-gray-200 group-hover:text-white transition-colors truncate" title={job.title}>{job.title}</span>
                    <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadgeClass(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-gray-500 font-medium">
                    <span>{job.status === 'Failed' ? 'See details' : `${job.clips} clip${job.clips === 1 ? '' : 's'}`}</span>
                    <span>{timeAgo(job.createdAt)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
          {recentJobs.length > 0 && (
            <Link to="/projects" className="w-full mt-6 py-2.5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors text-xs font-semibold text-gray-300 text-center">
              View All History
            </Link>
          )}
        </div>

      </div>
    </div>
  );
};

export default Home;
