import { useState, useEffect } from 'react';
import { UploadCloud, Link as LinkIcon, Sparkles, Clock, Video, Activity, MoreVertical, Play, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Home = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [layout, setLayout] = useState('vertical');
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState({
    totalClips: 0,
    hoursProcessed: 0,
    avgVirality: '0%'
  });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [analyticsRes, jobsRes] = await Promise.all([
          fetch(`${API_URL}/api/analytics`),
          fetch(`${API_URL}/api/jobs`)
        ]);
        if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          setRecentJobs(jobsData.slice(0, 4)); // Only show top 4 recent jobs
        }
      } catch (e) {
        console.error('Failed to fetch dashboard data:', e);
      }
    };
    fetchDashboardData();
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
        new URL(videoUrl);
      } catch (err) {
        setErrorMsg('Invalid URL. Please enter a valid HTTP/HTTPS URL.');
        return;
      }
    }
    
    try {
      let body;
      let headers: HeadersInit = {};
      
      if (file) {
        const formData = new FormData();
        formData.append('video', file);
        formData.append('layout', layout);
        body = formData;
      } else {
        body = JSON.stringify({ videoUrl: videoUrl, layout: layout });
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: headers,
        body: body
      });
      
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      navigate(`/processing/${data.jobId}`);
    } catch (error) {
      console.error("Failed to submit job", error);
      alert("Failed to submit job. Ensure the Node.js backend is running and the file is valid.");
    }
  };

  return (
    <div className="w-full flex flex-col p-8 lg:p-10 animate-fade-in-up">
      
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Project Overview</h1>
        <p className="text-gray-400 font-medium">Welcome back. Manage and automate your video pipeline.</p>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden group hover:border-white/20 transition-all duration-300">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <Video className="w-5 h-5 text-gray-200" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Total Clips</p>
              <p className="text-3xl font-bold text-white tracking-tight">{analytics.totalClips.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-[10px] font-semibold text-white/70 bg-white/5 self-start px-2 py-1 rounded border border-white/10">Real Data</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden group hover:border-white/20 transition-all duration-300">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <Clock className="w-5 h-5 text-gray-200" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Hours Processed</p>
              <p className="text-3xl font-bold text-white tracking-tight">{analytics.hoursProcessed}h</p>
            </div>
          </div>
          <div className="text-[10px] font-semibold text-white/70 bg-white/5 self-start px-2 py-1 rounded border border-white/10">Real Data</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden group hover:border-white/20 transition-all duration-300">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <Activity className="w-5 h-5 text-gray-200" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Avg. Virality</p>
              <p className="text-3xl font-bold text-white tracking-tight">{analytics.avgVirality}</p>
            </div>
          </div>
          <div className="text-[10px] font-semibold text-white/70 bg-white/5 self-start px-2 py-1 rounded border border-white/10">Real Data</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Widget (Span 2) */}
        <div className="lg:col-span-2 relative animate-slide-up" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
          
          <div className="relative glass-panel rounded-3xl p-8 overflow-hidden transition-all duration-500">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
                <Sparkles className="w-4 h-4 text-white" />
                New Extraction Job
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-2 group">
                {errorMsg && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm font-medium mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {errorMsg}
                  </div>
                )}
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <LinkIcon className="w-3 h-3" />
                  YouTube or Web URL
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className={`w-full px-4 py-3 bg-black/40 border ${errorMsg ? 'border-red-500/50' : 'border-white/10'} rounded-xl focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40 transition-all duration-300 placeholder:text-gray-600 text-white shadow-inner text-sm`}
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
                <input id="file-upload" type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <div className="bg-white/5 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform duration-300 border border-white/10">
                  <UploadCloud className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-200 mb-1">{file ? file.name : "Drag & drop file"}</p>
                  <p className="text-[11px] text-gray-500 font-medium">{file ? `${(file.size / (1024*1024)).toFixed(2)} MB` : "MP4, MOV up to 2GB"}</p>
                </div>
              </div>

              {/* Target Format Layout Selector */}
              <div className="space-y-3">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Video className="w-3 h-3" />
                  Target Video Format
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setLayout('vertical')}
                    className={`py-3 px-4 rounded-xl border text-sm flex flex-col items-center justify-center gap-1 transition-all duration-300
                      ${layout === 'vertical'
                        ? 'border-white bg-white text-black shadow-lg'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/30 hover:text-gray-200'}`}
                  >
                    <span className="text-sm font-bold">9:16 Vertical</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${layout === 'vertical' ? 'text-gray-700' : 'text-gray-500'}`}>TikTok / Reels / Shorts</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLayout('horizontal')}
                    className={`py-3 px-4 rounded-xl border text-sm flex flex-col items-center justify-center gap-1 transition-all duration-300
                      ${layout === 'horizontal'
                        ? 'border-white bg-white text-black shadow-lg'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/30 hover:text-gray-200'}`}
                  >
                    <span className="text-sm font-bold">16:9 Horizontal</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${layout === 'horizontal' ? 'text-gray-700' : 'text-gray-500'}`}>Landscape / Standard Web</span>
                  </button>
                </div>
              </div>

              <button type="submit" disabled={!videoUrl && !file} className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] disabled:opacity-50 disabled:cursor-not-allowed mt-4">
                <Play className="w-4 h-4 fill-current" />
                <span>Process Video Pipeline</span>
              </button>

              <div className="mt-4 p-4 border border-white/5 rounded-xl flex gap-3 items-start bg-white/[0.01]">
                <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
                  <strong>Guidelines:</strong> Clips are formatted for social media. Ensure you use properly licensed content. Copyright compliance depends entirely on the source content.
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Recent Jobs Table / List (Span 1) */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col h-full animate-slide-up" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-white tracking-tight">Recent Jobs</h3>
            <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><MoreVertical className="w-4 h-4 text-gray-400" /></button>
          </div>
          
          <div className="flex-1 flex flex-col gap-3">
            {recentJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 py-10">
                <Activity className="w-6 h-6 mb-2 opacity-50" />
                <p className="text-sm font-medium">No recent jobs found</p>
              </div>
            ) : (
              recentJobs.map((job) => (
                <div key={job.id} onClick={() => navigate(`/processing/${job.id}`)} className="p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm text-gray-200 group-hover:text-white transition-colors truncate max-w-[150px]">{job.title}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      job.status === 'Completed' ? 'border-green-500/30 text-green-400 bg-green-500/10' : 
                      job.status === 'Processing' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : 
                      'border-red-500/30 text-red-400 bg-red-500/10'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-gray-500 font-medium">
                    <span>{job.id}</span>
                    <span className="flex items-center gap-2">
                      <span>{job.clips} clips</span>
                      <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                      <span>{job.time}</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          {recentJobs.length > 0 && (
            <button onClick={() => navigate('/projects')} className="w-full mt-6 py-2.5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors text-xs font-semibold text-gray-300">
              View All History
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default Home;
