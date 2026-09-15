import { useState } from 'react';
import { UploadCloud, Link as LinkIcon, Sparkles, Video, Play, AlertTriangle, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, errorMessage } from '../api';

const AutoEdit = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [layout, setLayout] = useState('9:16');
  const [style, setStyle] = useState('Cinematic');
  const [prompt, setPrompt] = useState('');
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
        formData.append('style', style);
        formData.append('prompt', prompt);
        body = formData;
      } else {
        body = JSON.stringify({ videoUrl, layout, style, prompt });
      }

      const data = await apiFetch<{ jobId: string }>('/api/auto-edit', { method: 'POST', body });
      navigate(`/processing/${data.jobId}`);
    } catch (error) {
      setErrorMsg(errorMessage(error, 'Failed to submit the job.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col p-8 lg:p-10 animate-fade-in-up">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">AI Auto Video Editor</h1>
        <p className="text-gray-400 font-medium">Upload a raw video and let AI cut it into a tight story with zooms, color grading and animated subtitles.</p>
      </div>

      <div className="w-full max-w-3xl relative animate-slide-up" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
        <div className="relative glass-panel rounded-3xl p-8 overflow-hidden transition-all duration-500">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
              <Sparkles className="w-4 h-4 text-white" />
              Configure Editing Job
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 group">
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm font-medium mb-4 flex items-center gap-2" role="alert">
                  <AlertTriangle className="w-4 h-4" />
                  {errorMsg}
                </div>
              )}
              <label htmlFor="auto-video-url" className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <LinkIcon className="w-3 h-3" aria-hidden="true" />
                Raw Video URL
              </label>
              <input
                id="auto-video-url"
                disabled={Boolean(file)}
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
              <input id="file-upload" type="file" aria-label="Choose a video file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="video/*" onChange={(e) => { setFile(e.target.files?.[0] || null); setVideoUrl(''); }} />
              <div className="bg-white/5 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform duration-300 border border-white/10">
                <UploadCloud className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-200 mb-1">{file ? file.name : "Drag & drop raw video file"}</p>
                <p className="text-[11px] text-gray-500 font-medium">{file ? `${(file.size / (1024*1024)).toFixed(2)} MB` : "MP4, MOV up to 2GB"}</p>
              </div>
              {file && (
                <button type="button" onClick={() => setFile(null)} className="relative z-20 mt-3 text-xs font-semibold text-gray-300 hover:text-white flex items-center gap-1">
                  <X className="w-3 h-3" aria-hidden="true" /> Remove file
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label htmlFor="auto-layout" className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Video className="w-3 h-3" aria-hidden="true" />
                  Target Aspect Ratio
                </label>
                <select 
                  id="auto-layout"
                  value={layout} 
                  onChange={(e) => setLayout(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-white/40 text-white text-sm"
                >
                  <option value="9:16">9:16 (TikTok, Reels, Shorts)</option>
                  <option value="16:9">16:9 (YouTube, Horizontal)</option>
                  <option value="1:1">1:1 (Instagram Post)</option>
                </select>
              </div>

              <div className="space-y-3">
                <label htmlFor="auto-style" className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  Editing Style
                </label>
                <select 
                  id="auto-style"
                  value={style} 
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-white/40 text-white text-sm"
                >
                  <option value="Cinematic">Cinematic</option>
                  <option value="Viral Reels">Viral Reels</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Podcast">Podcast</option>
                  <option value="Motivational">Motivational</option>
                  <option value="Vlog">Vlog</option>
                  <option value="Gaming">Gaming</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label htmlFor="auto-prompt" className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                Custom Prompt (Optional)
              </label>
              <textarea
                id="auto-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Keep only the funniest moments and focus on the product demo."
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-white/40 text-white text-sm min-h-[100px]"
              />
            </div>

            <button type="submit" disabled={(!videoUrl && !file) || submitting} className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-sm font-bold text-black bg-white hover:bg-gray-100 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] disabled:opacity-50 disabled:cursor-not-allowed mt-4">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Play className="w-4 h-4 fill-current" aria-hidden="true" />}
              <span>{submitting ? (file ? 'Uploading...' : 'Starting...') : 'Start Auto Edit'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AutoEdit;
