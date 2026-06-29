import React, { useState, useEffect } from 'react';
import { BookOpen, Play, CheckCircle2, Loader2, Sparkles, AlertCircle, Video } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const StoryToVideo = () => {
  const [story, setStory] = useState('');
  const [style, setStyle] = useState('Cinematic');
  const [voice, setVoice] = useState('en-US-ChristopherNeural');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGenerate = async () => {
    if (!story.trim()) {
      setErrorMsg('Please enter a story or text first.');
      return;
    }
    
    setErrorMsg('');
    setStatus('processing');
    setProgress(5);
    setMessage('Submitting your story...');

    try {
      const response = await fetch(`${API_URL}/api/story-to-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story, style, voice, aspectRatio }),
      });

      // Check if response is HTML (like a 404 page from missing route)
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to start job');
        setJobId(data.jobId);
      } else {
        throw new Error('Server returned an invalid response. Did you forget to restart the backend?');
      }
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (jobId && status === 'processing') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/api/jobs/${jobId}`);
          if (!res.ok) {
             if (res.status === 404) return; // Not registered yet
             throw new Error('Failed to fetch status');
          }
          
          const contentType = res.headers.get("content-type");
          if (!contentType || contentType.indexOf("application/json") === -1) {
            throw new Error('Invalid polling response. Backend might be down.');
          }

          const data = await res.json();
          
          if (data.status === 'processing') {
            setProgress(data.progress || 10);
            setMessage(data.message || 'Processing...');
          } else if (data.status === 'completed' || data.status === 'Completed') {
            setStatus('completed');
            setProgress(100);
            setMessage('Video generation complete!');
            
            if (data.clips && data.clips.length > 0) {
               setVideoUrl(`${API_URL}${data.clips[0].video_url}`);
            } else if (data.clipsData && data.clipsData.length > 0) {
               setVideoUrl(`${API_URL}${data.clipsData[0].video_url}`);
            }
          } else if (data.status === 'failed' || data.status === 'Failed') {
            setStatus('error');
            setErrorMsg(data.message || 'Job failed');
          }
        } catch (e) {
          console.error(e);
        }
      }, 2000);
    }
    
    return () => clearInterval(interval);
  }, [jobId, status]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 md:pt-12 relative z-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-[#66fcf1]" />
          AI Story to Video
        </h1>
        <p className="text-gray-400 max-w-2xl text-sm leading-relaxed">
          Paste your novel chapter, script, or story idea below. Our AI will automatically break it into scenes, generate visual prompts, create narration, and render a complete video.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Input */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-[#66fcf1]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#45a29e]" />
              Your Story
            </h2>
            
            <textarea 
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Once upon a time in a cyberpunk city..."
              className="w-full h-64 bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#66fcf1]/50 focus:ring-1 focus:ring-[#66fcf1]/50 transition-all resize-none text-sm"
              disabled={status === 'processing'}
            ></textarea>

            {errorMsg && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{errorMsg}</p>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
             <div className="glass-panel p-4 rounded-xl border border-white/5">
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Video Style</label>
                <select 
                  value={style} 
                  onChange={(e) => setStyle(e.target.value)}
                  disabled={status === 'processing'}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-[#66fcf1]/50"
                >
                  <option value="Cinematic">Cinematic</option>
                  <option value="Anime">Anime</option>
                  <option value="Realistic">Realistic</option>
                  <option value="Cyberpunk">Cyberpunk</option>
                  <option value="Cartoon">Cartoon</option>
                  <option value="Watercolor">Watercolor</option>
                  <option value="3D Animation">3D Animation</option>
                </select>
             </div>
             
             <div className="glass-panel p-4 rounded-xl border border-white/5">
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Aspect Ratio</label>
                <select 
                  value={aspectRatio} 
                  onChange={(e) => setAspectRatio(e.target.value)}
                  disabled={status === 'processing'}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-[#66fcf1]/50"
                >
                  <option value="9:16">Vertical (9:16) - Shorts/TikTok</option>
                  <option value="16:9">Horizontal (16:9) - YouTube</option>
                  <option value="1:1">Square (1:1) - Instagram</option>
                </select>
             </div>
             
             <div className="glass-panel p-4 rounded-xl border border-white/5">
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Narration Voice</label>
                <select 
                  value={voice} 
                  onChange={(e) => setVoice(e.target.value)}
                  disabled={status === 'processing'}
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-[#66fcf1]/50"
                >
                  <option value="en-US-ChristopherNeural">Christopher (Deep Male)</option>
                  <option value="en-US-AriaNeural">Aria (Clear Female)</option>
                  <option value="en-US-GuyNeural">Guy (Friendly Male)</option>
                  <option value="en-GB-SoniaNeural">Sonia (British Female)</option>
                </select>
             </div>
          </div>
          
          <button
            onClick={handleGenerate}
            disabled={status === 'processing'}
            className="group relative w-full bg-[#66fcf1] text-black font-semibold py-4 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(102,252,241,0.3)] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none flex items-center justify-center gap-2"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            {status === 'processing' ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
            ) : (
              <><Play className="w-5 h-5" fill="currentColor" /> Generate Video</>
            )}
          </button>
        </div>

        {/* Right Column: Output / Status */}
        <div className="flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 h-full min-h-[400px] flex flex-col">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
              <Video className="w-5 h-5 text-[#66fcf1]" />
              Generation Status
            </h2>
            
            {status === 'idle' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 gap-4">
                <BookOpen className="w-12 h-12 opacity-20" />
                <p className="text-sm">Enter a story and click generate to see the magic happen.</p>
              </div>
            )}
            
            {status === 'processing' && (
              <div className="flex-1 flex flex-col justify-center">
                <div className="flex justify-between text-sm mb-2 font-medium">
                  <span className="text-[#66fcf1]">{message}</span>
                  <span className="text-white">{progress}%</span>
                </div>
                <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-gradient-to-r from-[#45a29e] to-[#66fcf1] transition-all duration-300 rounded-full relative overflow-hidden"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
                <div className="mt-8 text-center text-xs text-gray-400 animate-pulse">
                  The AI is breaking your story into scenes, painting the visuals, and recording the narration. This usually takes 1-3 minutes.
                </div>
              </div>
            )}
            
            {status === 'completed' && videoUrl && (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-green-400 mb-4 bg-green-400/10 p-3 rounded-lg border border-green-400/20">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Video successfully generated!</span>
                </div>
                <div className="relative w-full aspect-[9/16] bg-black rounded-lg overflow-hidden border border-white/10 shadow-2xl mx-auto max-w-[280px]">
                  <video 
                    src={videoUrl} 
                    controls 
                    autoPlay 
                    className="w-full h-full object-cover"
                  ></video>
                </div>
                <a 
                  href={videoUrl}
                  download
                  className="mt-6 w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  Download Video
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryToVideo;
