import React, { useState, useEffect } from 'react';
import { CheckCircle, Play, Share2, Download, ArrowLeft, FileText, Copy } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface ClipResult {
  id: string;
  url: string;
  title: string;
  duration: string;
  score: number;
  reasoning: string;
  segments?: any[];
}

const Results = () => {
  const { jobId } = useParams();
  const [clips, setClips] = useState<ClipResult[]>([]);
  const [transcript, setTranscript] = useState<string>('');
  const [activeClip, setActiveClip] = useState<ClipResult | null>(null);

  useEffect(() => {
    if (!jobId) return;
    
    const fetchResults = async () => {
      try {
        const response = await fetch(`${API_URL}/api/jobs/${jobId}`);
        if (!response.ok) return;
        const data = await response.json();
        
        if (data.transcript) {
          setTranscript(data.transcript);
        }

        if (data.clips && data.clips.length > 0) {
          const mappedClips = data.clips.map((c: any, i: number) => {
            const hasSegments = c.segments && c.segments.length > 0;
            const calculatedDuration = hasSegments
              ? `${Math.round(c.segments[c.segments.length - 1].end - c.segments[0].start)}s`
              : 'Full Highlight';
            return {
              id: String(i),
              url: `${API_URL}${c.video_url}`,
              title: c.title,
              duration: calculatedDuration,
              score: c.score || 95,
              reasoning: c.reasoning || "Highly engaging viral segment detected by Gemini.",
              segments: c.segments || [],
              thumbnail: c.thumbnail_url ? `${API_URL}${c.thumbnail_url}` : null
            };
          });
          setClips(mappedClips);
          setActiveClip(mappedClips[0]);
        }
      } catch (e) {
        console.error("Error fetching results", e);
      }
    };
    
    fetchResults();
  }, [jobId]);

  const formatTime = (secs: number) => {
    if (typeof secs !== 'number') return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in-up mt-10 px-4 md:px-8">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6 bg-black/20 p-8 rounded-3xl backdrop-blur-md border border-white/10">
        <div>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-3 flex items-center gap-4 drop-shadow-xl">
            <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-[#66fcf1]" />
            Your Viral Clips
          </h2>
          <p className="text-lg md:text-xl text-white/80 font-bold">We identified {clips.length} highly engaging moments.</p>
        </div>
        <Link 
          to="/"
          className="flex items-center gap-2 px-6 py-4 rounded-xl bg-white hover:bg-gray-100 text-black text-lg font-black shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5" /> Convert Another Video
        </Link>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Active Clip Preview (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {activeClip ? (
            <div className="glass-panel-dark rounded-[2.5rem] p-6 md:p-8 border border-white/10 flex flex-col gap-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-[#66fcf1]/30 to-transparent"></div>
              
              {/* Vertical 9:16 Video Player Container */}
              <div className="aspect-[9/16] w-full max-w-[340px] mx-auto bg-black rounded-3xl overflow-hidden border-2 border-white/10 relative shadow-[0_0_50px_rgba(102,252,241,0.05)] group">
                <video 
                  key={activeClip.url}
                  src={activeClip.url}
                  controls
                  autoPlay
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Clip Title & Stats */}
              <div className="space-y-5">
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-xl md:text-2xl font-black text-white leading-tight drop-shadow-md">
                    {activeClip.title}
                  </h3>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Virality Score</span>
                    <span className="flex items-center gap-1 bg-[#66fcf1] text-black px-3 py-1 rounded-lg text-lg font-black shadow-[0_0_15px_rgba(102,252,241,0.4)]">
                      {activeClip.score}
                    </span>
                  </div>
                </div>

                {/* Subtitle / Timeline segments */}
                {activeClip.segments && activeClip.segments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs uppercase text-purple-400 font-bold tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Clip Subtitles Track
                    </h4>
                    <div className="bg-black/50 border border-white/5 p-4 rounded-2xl max-h-36 overflow-y-auto font-medium text-sm text-gray-300 leading-relaxed shadow-inner">
                      {activeClip.segments.map((seg, idx) => (
                        <span key={idx} className="inline-block mr-3 mb-1 hover:text-white transition-colors">
                          <span className="text-[10px] text-gray-600 font-mono select-none">[{formatTime(seg.start)}-{formatTime(seg.end)}]</span>{" "}
                          {seg.text}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Reasoning Panel */}
                <div className="bg-[#66fcf1]/5 border border-[#66fcf1]/10 p-4 rounded-2xl">
                  <h4 className="text-xs uppercase text-[#66fcf1] font-bold tracking-wider mb-2">AI Virality Explanation</h4>
                  <p className="text-sm text-gray-300 leading-relaxed font-medium">
                    {activeClip.reasoning}
                  </p>
                </div>

                {/* Share/Download Actions */}
                <div className="flex gap-4 pt-2">
                  <button onClick={() => { navigator.clipboard.writeText(activeClip.url); alert("Link copied to clipboard!"); }} className="flex-1 flex items-center justify-center gap-2 py-4 glass-panel hover:bg-white/10 rounded-xl transition-colors text-base font-bold text-white border-white/30">
                    <Share2 className="w-5 h-5" /> Copy Link
                  </button>
                  <a href={activeClip.url} download className="flex-1 flex items-center justify-center gap-2 py-4 bg-white hover:bg-gray-200 text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] rounded-xl transition-colors text-base font-black">
                    <Download className="w-5 h-5" /> Download
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-20 text-center rounded-3xl flex flex-col items-center justify-center h-full">
              <Play className="w-16 h-16 text-gray-500 opacity-50 mb-4 animate-pulse" />
              <p className="text-gray-400 font-bold">Select a clip from the side to begin previewing</p>
            </div>
          )}
        </div>

        {/* Right: Clip List Sidebar (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <h3 className="text-lg font-bold text-white px-2">Generated Highlights ({clips.length})</h3>
          <div className="flex flex-col gap-4 max-h-[850px] overflow-y-auto pr-2 custom-scrollbar">
            {clips.map((clip) => {
              const isSelected = activeClip?.id === clip.id;
              return (
                <div 
                  key={clip.id}
                  onClick={() => setActiveClip(clip)}
                  className={`glass-panel-dark p-4 rounded-2xl flex gap-4 cursor-pointer transition-all duration-300 border-2 hover:-translate-y-0.5
                    ${isSelected 
                      ? 'border-[#66fcf1] bg-white/[0.04] shadow-[0_0_25px_rgba(102,252,241,0.12)]' 
                      : 'border-white/5 bg-black/20 hover:border-white/20'}`}
                >
                  {/* Thumbnail Preview Area */}
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-black relative overflow-hidden flex-shrink-0 flex items-center justify-center border border-white/10">
                    <img 
                      src={clip.thumbnail || `https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&auto=format&fit=crop&q=80`}
                      alt="Clip Thumbnail"
                      className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className={`p-2 rounded-full ${isSelected ? 'bg-[#66fcf1] text-black shadow-glow' : 'bg-white/10 text-white'}`}>
                        <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </div>

                  {/* Clip Details */}
                  <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                    <div>
                      <h4 className={`text-base font-bold truncate ${isSelected ? 'text-[#66fcf1]' : 'text-white'}`}>
                        {clip.title}
                      </h4>
                      <p className="text-xs text-gray-500 font-semibold mt-1">
                        Duration: {clip.duration}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Virality Score</span>
                      <span className="text-xs font-black text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                        {clip.score}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
      
      {/* Transcript Section */}
      {transcript && (
        <div className="mt-16 glass-panel-dark p-8 rounded-3xl border border-white/10 animate-fade-in-up">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-2xl font-black text-white flex items-center gap-3">
              <FileText className="w-6 h-6 text-[#66fcf1]" />
              Full Video Transcript
            </h3>
            <button 
              onClick={() => { navigator.clipboard.writeText(transcript); alert('Copied to clipboard!'); }}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold text-white transition-colors border border-white/20"
            >
              <Copy className="w-5 h-5" /> Copy Text
            </button>
          </div>
          <div className="p-8 bg-black/60 rounded-2xl max-h-[500px] overflow-y-auto font-medium text-gray-300 leading-loose text-base border border-white/10 shadow-inner">
            {transcript}
          </div>
        </div>
      )}
      
      <div className="mt-12 text-center pb-10">
        <button className="px-10 py-5 bg-black/40 hover:bg-black/60 backdrop-blur-xl border-2 border-white/30 rounded-2xl transition-colors text-lg font-black text-white shadow-xl inline-flex items-center gap-3 hover:scale-105">
          <Download className="w-6 h-6" /> Download All Clips (.zip)
        </button>
      </div>
    </div>
  );
};

export default Results;

