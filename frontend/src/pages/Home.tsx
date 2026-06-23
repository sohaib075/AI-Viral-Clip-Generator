import { useState } from 'react';
import { UploadCloud, Link as LinkIcon, Sparkles, Clock, Video, Activity, MoreVertical, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();

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
    if (!videoUrl && !file) return;
    
    try {
      let body;
      let headers: HeadersInit = {};
      
      if (file) {
        const formData = new FormData();
        formData.append('video', file);
        body = formData;
      } else {
        body = JSON.stringify({ videoUrl: videoUrl });
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch('http://localhost:5000/api/jobs', {
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
    <div className="w-full flex flex-col p-8 animate-fade-in-up">
      
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white mb-2">Project Overview</h1>
        <p className="text-gray-400 font-medium">Welcome back! Here's what's happening with your video pipeline.</p>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden group hover:border-[#66fcf1]/50 transition-colors">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#66fcf1]/10 rounded-full blur-2xl group-hover:bg-[#66fcf1]/20 transition-all"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#66fcf1]/10 flex items-center justify-center border border-[#66fcf1]/20">
              <Video className="w-6 h-6 text-[#66fcf1]" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Total Clips</p>
              <p className="text-3xl font-black text-white">1,284</p>
            </div>
          </div>
          <div className="text-sm font-semibold text-[#66fcf1] bg-[#66fcf1]/10 self-start px-2 py-1 rounded-md">+24% this week</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden group hover:border-purple-500/50 transition-colors">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Clock className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Hours Processed</p>
              <p className="text-3xl font-black text-white">43.5h</p>
            </div>
          </div>
          <div className="text-sm font-semibold text-purple-400 bg-purple-500/10 self-start px-2 py-1 rounded-md">8.2h remaining</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden group hover:border-pink-500/50 transition-colors">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-500/20 transition-all"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
              <Activity className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-bold uppercase tracking-wider">Avg. Virality</p>
              <p className="text-3xl font-black text-white">94%</p>
            </div>
          </div>
          <div className="text-sm font-semibold text-green-400 bg-green-500/10 self-start px-2 py-1 rounded-md">Top Tier Performance</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Widget (Span 2) */}
        <div className="lg:col-span-2 relative animate-scale-in" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
          <div className="absolute inset-0 bg-gradient-to-b from-purple-500/20 to-[#66fcf1]/10 rounded-[2rem] blur-xl pointer-events-none"></div>
          
          <div className="relative glass-panel-dark rounded-[2rem] p-8 overflow-hidden transition-all duration-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                New Extraction Job
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-3 group">
                <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-gray-400 group-focus-within:text-[#66fcf1] transition-colors" />
                  YouTube or Web URL
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full pl-5 pr-5 py-4 bg-black/50 border border-white/10 rounded-xl focus:outline-none focus:border-[#66fcf1]/50 focus:ring-1 focus:ring-[#66fcf1]/50 transition-all duration-300 placeholder:text-gray-600 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-white/10"></div>
                <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">OR</span>
                <div className="flex-1 h-[1px] bg-gradient-to-r from-white/10 via-white/10 to-transparent"></div>
              </div>

              <div 
                className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-all duration-300 ease-out cursor-pointer group overflow-hidden
                  ${dragActive ? "border-[#66fcf1] bg-[#66fcf1]/5 scale-[1.02]" : "border-white/10 bg-black/20 hover:border-purple-500/30 hover:bg-white/[0.02]"}`}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              >
                <input id="file-upload" type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <div className="bg-white/5 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-white/5">
                  <UploadCloud className="w-6 h-6 text-gray-300 group-hover:text-purple-400 transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-gray-200 mb-1">{file ? file.name : "Drag & drop file"}</p>
                  <p className="text-xs text-gray-500 font-medium">{file ? `${(file.size / (1024*1024)).toFixed(2)} MB` : "MP4, MOV up to 2GB"}</p>
                </div>
              </div>

              <button type="submit" disabled={!videoUrl && !file} className="group relative w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl text-sm font-bold text-black transition-all duration-300 overflow-hidden bg-white hover:bg-gray-100 shadow-[0_0_40px_-10px_rgba(255,255,255,0.4)] disabled:opacity-30 disabled:cursor-not-allowed">
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-black/5 to-transparent pointer-events-none"></div>
                <Play className="w-4 h-4 fill-current" />
                <span>Process Video Pipeline</span>
              </button>
            </form>
          </div>
        </div>

        {/* Recent Jobs Table / List (Span 1) */}
        <div className="glass-panel p-6 rounded-[2rem] flex flex-col h-full animate-fade-in-up" style={{ animationDelay: '0.4s', opacity: 0, animationFillMode: 'forwards' }}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white">Recent Jobs</h3>
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors"><MoreVertical className="w-4 h-4 text-gray-400" /></button>
          </div>
          
          <div className="flex-1 flex flex-col gap-4">
            {[
              { id: 'job_4821', title: 'Lex Fridman Podcast #394', status: 'Completed', time: '2h ago', clips: 12 },
              { id: 'job_4820', title: 'Huberman Lab: Dopamine', status: 'Completed', time: '5h ago', clips: 8 },
              { id: 'job_4819', title: 'Keynote Speech 2024', status: 'Failed', time: '1d ago', clips: 0 },
              { id: 'job_4818', title: 'Marketing Meeting', status: 'Completed', time: '2d ago', clips: 3 },
            ].map((job) => (
              <div key={job.id} className="p-4 rounded-xl bg-black/40 border border-white/5 hover:border-white/20 transition-colors flex flex-col gap-2 cursor-pointer">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm text-white truncate max-w-[150px]">{job.title}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${job.status === 'Completed' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {job.status}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
                  <span>{job.id}</span>
                  <span className="flex items-center gap-3">
                    <span>{job.clips} clips</span>
                    <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                    <span>{job.time}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-sm font-bold text-gray-300">
            View All Jobs
          </button>
        </div>

      </div>
    </div>
  );
};

export default Home;
