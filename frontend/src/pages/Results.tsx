import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Play, Share2, Download, ArrowLeft, FileText, Copy, Sliders, Type, Palette, Move, Camera, MessageCircle, Briefcase, Video, Loader, Globe, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface WordTiming {
  start: number;
  end: number;
  word: string;
}

interface ClipResult {
  id: string;
  url: string;
  base_url?: string;
  title: string;
  duration: string;
  start_time?: number;
  end_time?: number;
  score: number;
  reasoning: string;
  segments?: any[];
  words?: WordTiming[];
  emphasized_words?: string[];
  metadata?: any;
  thumbnail?: string | null;
}

interface StyleConfig {
  theme: string;
  fontName: string;
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  marginV: number;
}

const Results = () => {
  const { jobId } = useParams();
  const [clips, setClips] = useState<ClipResult[]>([]);
  const [transcript, setTranscript] = useState<string>('');
  const [activeClip, setActiveClip] = useState<ClipResult | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  
  const [activeTab, setActiveTab] = useState<'final_clip' | 'customizer' | 'metadata'>('final_clip');
  
  const [styleConfig, setStyleConfig] = useState<StyleConfig>({
    theme: 'Modern',
    fontName: 'Arial Black',
    fontSize: 64,
    primaryColor: '&H00FFFFFF', // ASS format White
    highlightColor: '&H0000FFFF', // ASS format Yellow
    marginV: 500
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishForm, setPublishForm] = useState({
    title: '',
    description: '',
    hashtags: '',
    platforms: ['youtube', 'tiktok', 'instagram'],
    scheduled_time: 'now'
  });
  const [isPublishing, setIsPublishing] = useState(false);

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
              base_url: c.base_url ? `${API_URL}${c.base_url}` : `${API_URL}${c.video_url}`,
              title: c.title,
              duration: calculatedDuration,
              start_time: c.start_time,
              end_time: c.end_time,
              score: c.score || 95,
              reasoning: c.reasoning || "Highly engaging viral segment detected by Gemini.",
              segments: c.segments || [],
              words: c.words || [],
              emphasized_words: c.emphasized_words || [],
              metadata: c.metadata || {},
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

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleExport = async () => {
    if (!activeClip || !jobId) return;
    
    setIsExporting(true);
    setExportUrl(null);
    try {
      const response = await fetch(`${API_URL}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          clipUrl: activeClip.base_url || activeClip.url,
          styleConfig,
          clipData: activeClip
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setExportUrl(`${API_URL}${data.export_url}`);
      } else {
        alert("Export failed: " + data.error);
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred during export.");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const response = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip_url: exportUrl, // Post the finalized URL
          platforms: publishForm.platforms,
          title: publishForm.title || activeClip?.title,
          description: publishForm.description,
          hashtags: publishForm.hashtags,
          scheduled_time: publishForm.scheduled_time
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert("Post scheduled successfully! Check the Publishing Queue.");
        setShowPublishModal(false);
      } else {
        alert("Failed to schedule: " + data.error);
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while publishing.");
    } finally {
      setIsPublishing(false);
    }
  };

  const formatTime = (secs: number) => {
    if (typeof secs !== 'number') return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Convert ASS color string to CSS color (very simple approximation)
  const assToCssColor = (assColor: string) => {
    if (assColor === '&H00FFFFFF') return 'white';
    if (assColor === '&H0000FFFF') return '#ffff00'; // Yellow
    if (assColor === '&H00FF0000') return '#0000ff'; // Blue (ASS is BGR)
    if (assColor === '&H000000FF') return '#ff0000'; // Red
    if (assColor === '&H0000FF00') return '#00ff00'; // Green
    return 'white';
  };

  const cssPrimaryColor = assToCssColor(styleConfig.primaryColor);
  const cssHighlightColor = assToCssColor(styleConfig.highlightColor);

  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in-up mt-10 px-4 md:px-8">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6 bg-black/20 p-8 rounded-3xl backdrop-blur-md border border-white/10">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3 flex items-center gap-4">
            <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-white" />
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
        
        {/* Left: Active Clip Preview & Settings (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {activeClip ? (
            <div className="glass-panel border border-white/5 rounded-[2.5rem] p-6 md:p-8 border border-white/10 flex flex-col gap-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
              
              <div className="flex justify-center gap-4 mb-2">
                <button 
                  onClick={() => setActiveTab('final_clip')}
                  className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'final_clip' ? 'bg-white text-black shadow-md' : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'}`}
                >
                  Final Output
                </button>
                <button 
                  onClick={() => setActiveTab('customizer')}
                  className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'customizer' ? 'bg-white text-black shadow-md' : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'}`}
                >
                  Customizer
                </button>
                <button 
                  onClick={() => setActiveTab('metadata')}
                  className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'metadata' ? 'bg-white text-black shadow-md' : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'}`}
                >
                  Social Media
                </button>
              </div>

              {activeTab === 'final_clip' && (
                <div className="flex flex-col gap-6 items-center">
                  <p className="text-gray-400 font-bold text-center">This is the final generated video with hardcoded, properly synced captions.</p>
                  <div className="relative aspect-[9/16] w-full max-w-[320px] mx-auto bg-black rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl">
                    <video 
                      key={activeClip.url}
                      src={activeClip.url}
                      controls
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <a href={activeClip.url} download className="w-full max-w-[320px] py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-[1.02]">
                    <Download className="w-5 h-5"/> Download Video
                  </a>
                  <button 
                    onClick={() => {
                        setPublishForm({
                            ...publishForm,
                            title: activeClip.title,
                            description: activeClip.metadata?.youtube_shorts?.description || '',
                            hashtags: activeClip.metadata?.youtube_shorts?.hashtags?.join(' ') || ''
                        });
                        setExportUrl(activeClip.url);
                        setShowPublishModal(true);
                    }}
                    className="w-full max-w-[320px] py-4 bg-white text-black font-bold rounded-xl hover:brightness-110 transition-all flex justify-center items-center gap-2 shadow-lg hover:scale-[1.02]"
                  >
                    <Globe className="w-5 h-5"/> Auto-Publish to Socials
                  </button>
                </div>
              )}

              {activeTab === 'customizer' && (
                <>
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Vertical 9:16 Video Player Container */}
                    <div className="relative aspect-[9/16] w-full max-w-[280px] mx-auto bg-black rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl flex-shrink-0 group">
                      <video 
                        ref={videoRef}
                        key={activeClip.base_url || activeClip.url}
                        src={activeClip.base_url || activeClip.url}
                        controls
                        autoPlay
                        onTimeUpdate={handleTimeUpdate}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Subtitle CSS Overlay */}
                      <div 
                        className="absolute w-full flex justify-center items-center pointer-events-none p-4 text-center"
                        style={{ 
                          bottom: `${styleConfig.marginV / 10}%`,
                          fontFamily: styleConfig.fontName,
                          fontSize: `${styleConfig.fontSize / 2}px`,
                          fontWeight: 900,
                          textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 10px rgba(0,0,0,0.8)'
                        }}
                      >
                        <div className="flex flex-wrap justify-center gap-[4px] leading-tight">
                          {activeClip.words?.filter(w => w.start <= currentTime + 1.0 && w.end >= currentTime - 1.0).map((w, idx) => {
                            const isActive = currentTime >= w.start && currentTime <= w.end;
                            return (
                              <span 
                                key={idx} 
                                style={{ 
                                  color: isActive ? cssHighlightColor : cssPrimaryColor,
                                  transform: isActive ? 'scale(1.15)' : 'scale(1)',
                                  transition: 'all 0.1s ease',
                                  display: 'inline-block'
                                }}
                              >
                                {w.word}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Editor Panel */}
                    <div className="flex-1 w-full space-y-6">
                      <div>
                        <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2"><Sliders className="w-5 h-5" /> Caption Customizer</h3>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2"><Type className="w-4 h-4"/> Theme</label>
                            <select 
                              value={styleConfig.theme}
                              onChange={(e) => setStyleConfig({...styleConfig, theme: e.target.value})}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-white"
                            >
                              <option value="Modern">Modern (Bold & Clean)</option>
                              <option value="Viral">Viral (Yellow Highlights)</option>
                              <option value="Podcast">Podcast (Minimal & Professional)</option>
                              <option value="Gaming">Gaming (High Contrast)</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2"><Palette className="w-4 h-4"/> Text Color</label>
                              <select 
                                value={styleConfig.primaryColor}
                                onChange={(e) => setStyleConfig({...styleConfig, primaryColor: e.target.value})}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-white"
                              >
                                <option value="&H00FFFFFF">White</option>
                                <option value="&H000000FF">Red</option>
                                <option value="&H0000FFFF">Yellow</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2"><Palette className="w-4 h-4"/> Highlight</label>
                              <select 
                                value={styleConfig.highlightColor}
                                onChange={(e) => setStyleConfig({...styleConfig, highlightColor: e.target.value})}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-white"
                              >
                                <option value="&H0000FFFF">Yellow</option>
                                <option value="&H00FF0000">Blue</option>
                                <option value="&H0000FF00">Green</option>
                                <option value="&H000000FF">Red</option>
                                <option value="&H00FFFFFF">White</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2"><Move className="w-4 h-4"/> Vertical Position</label>
                            <input 
                              type="range" 
                              min="50" max="900" 
                              value={styleConfig.marginV}
                              onChange={(e) => setStyleConfig({...styleConfig, marginV: parseInt(e.target.value)})}
                              className="w-full accent-[#66fcf1]"
                            />
                            <div className="flex justify-between text-[10px] text-gray-500 font-bold px-1 mt-1">
                              <span>Bottom</span>
                              <span>Middle</span>
                              <span>Top</span>
                            </div>
                          </div>
                          
                          <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2"><Type className="w-4 h-4"/> Font Size</label>
                            <input 
                              type="range" 
                              min="30" max="100" 
                              value={styleConfig.fontSize}
                              onChange={(e) => setStyleConfig({...styleConfig, fontSize: parseInt(e.target.value)})}
                              className="w-full accent-[#66fcf1]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/10">
                        {exportUrl ? (
                          <div className="flex flex-col gap-3">
                            <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-xl text-green-400 font-bold text-center flex items-center justify-center gap-2">
                              <CheckCircle className="w-5 h-5"/> Export Successful!
                            </div>
                            <a href={exportUrl} download className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-[1.02]">
                              <Download className="w-5 h-5"/> Download Final Video
                            </a>
                            <button 
                              onClick={() => {
                                  setPublishForm({
                                      ...publishForm,
                                      title: activeClip?.title || '',
                                      description: activeClip?.metadata?.youtube_shorts?.description || '',
                                      hashtags: activeClip?.metadata?.youtube_shorts?.hashtags?.join(' ') || ''
                                  });
                                  setShowPublishModal(true);
                              }}
                              className="w-full py-4 bg-white text-black font-bold rounded-xl hover:brightness-110 transition-all flex justify-center items-center gap-2 shadow-lg hover:scale-[1.02]"
                            >
                              <Globe className="w-5 h-5"/> Auto-Publish Custom Video
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={handleExport}
                            disabled={isExporting}
                            className={`w-full py-4 font-black rounded-xl transition-all flex justify-center items-center gap-2 hover:scale-[1.02] shadow-md ${isExporting ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-white text-black hover:brightness-110'}`}
                          >
                            {isExporting ? (
                              <><Loader className="w-5 h-5 animate-spin"/> Rendering Subtitles...</>
                            ) : (
                              <><Play className="w-5 h-5 fill-current"/> Burn Subtitles & Export</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {activeTab === 'metadata' && (
                <div className="space-y-6">
                  {/* Social Media Metadata Panel */}
                  <h3 className="text-xl font-black text-white mb-2">Social Media Pack</h3>
                  <p className="text-sm text-gray-400 font-medium mb-6">AI generated ready-to-post content for your clip.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* TikTok */}
                    {activeClip.metadata?.tiktok && (
                      <div className="glass-panel border border-white/10 p-5 rounded-2xl relative group hover:bg-white/5 transition-colors">
                        <div className="absolute top-4 right-4 text-gray-300 opacity-50 group-hover:opacity-100 transition-opacity"><svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg></div>
                        <h4 className="font-bold text-white mb-2 pr-8">{activeClip.metadata.tiktok.title}</h4>
                        <p className="text-sm text-gray-300 mb-3">{activeClip.metadata.tiktok.description}</p>
                        <p className="text-xs font-bold text-gray-300">{activeClip.metadata.tiktok.hashtags?.join(' ')}</p>
                        <button className="mt-3 text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded flex items-center gap-1 font-bold text-white transition-colors" onClick={() => {navigator.clipboard.writeText(`${activeClip.metadata?.tiktok.title}\n${activeClip.metadata?.tiktok.description}\n${activeClip.metadata?.tiktok.hashtags?.join(' ')}`); alert('Copied!');}}><Copy className="w-3 h-3"/> Copy</button>
                      </div>
                    )}
                    
                    {/* Instagram */}
                    {activeClip.metadata?.instagram && (
                      <div className="glass-panel border border-white/10 p-5 rounded-2xl relative group hover:bg-white/5 transition-colors">
                        <div className="absolute top-4 right-4 text-white opacity-50 group-hover:opacity-100 transition-opacity"><Camera className="w-6 h-6"/></div>
                        <h4 className="font-bold text-white mb-2 pr-8">{activeClip.metadata.instagram.title}</h4>
                        <p className="text-sm text-gray-300 mb-3">{activeClip.metadata.instagram.description}</p>
                        <p className="text-xs font-bold text-white">{activeClip.metadata.instagram.hashtags?.join(' ')}</p>
                        <button className="mt-3 text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded flex items-center gap-1 font-bold text-white transition-colors" onClick={() => {navigator.clipboard.writeText(`${activeClip.metadata?.instagram.title}\n${activeClip.metadata?.instagram.description}\n${activeClip.metadata?.instagram.hashtags?.join(' ')}`); alert('Copied!');}}><Copy className="w-3 h-3"/> Copy</button>
                      </div>
                    )}
                    
                    {/* YouTube Shorts */}
                    {activeClip.metadata?.youtube_shorts && (
                      <div className="glass-panel border border-white/10 p-5 rounded-2xl relative group hover:bg-white/5 transition-colors">
                        <div className="absolute top-4 right-4 text-gray-300 opacity-50 group-hover:opacity-100 transition-opacity"><Video className="w-6 h-6"/></div>
                        <h4 className="font-bold text-white mb-2 pr-8">{activeClip.metadata.youtube_shorts.title}</h4>
                        <p className="text-sm text-gray-300 mb-3">{activeClip.metadata.youtube_shorts.description}</p>
                        <p className="text-xs font-bold text-gray-300">{activeClip.metadata.youtube_shorts.hashtags?.join(' ')}</p>
                        <button className="mt-3 text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded flex items-center gap-1 font-bold text-white transition-colors" onClick={() => {navigator.clipboard.writeText(`${activeClip.metadata?.youtube_shorts.title}\n${activeClip.metadata?.youtube_shorts.description}\n${activeClip.metadata?.youtube_shorts.hashtags?.join(' ')}`); alert('Copied!');}}><Copy className="w-3 h-3"/> Copy</button>
                      </div>
                    )}
                    
                    {/* X */}
                    {activeClip.metadata?.x && (
                      <div className="glass-panel border border-white/10 p-5 rounded-2xl relative group hover:bg-white/5 transition-colors">
                        <div className="absolute top-4 right-4 text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity"><MessageCircle className="w-6 h-6"/></div>
                        <p className="text-sm text-gray-300 mb-3 pr-8">{activeClip.metadata.x.tweet}</p>
                        <p className="text-xs font-bold text-gray-400">{activeClip.metadata.x.hashtags?.join(' ')}</p>
                        <button className="mt-3 text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded flex items-center gap-1 font-bold text-white transition-colors" onClick={() => {navigator.clipboard.writeText(`${activeClip.metadata?.x.tweet}\n${activeClip.metadata?.x.hashtags?.join(' ')}`); alert('Copied!');}}><Copy className="w-3 h-3"/> Copy</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                  onClick={() => { setActiveClip(clip); setExportUrl(null); }}
                  className={`glass-panel border border-white/5 p-4 rounded-2xl flex gap-4 cursor-pointer transition-all duration-300 border-2 hover:-translate-y-0.5
                    ${isSelected 
                      ? 'border-white bg-white/[0.04] shadow-md' 
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
                      <div className={`p-2 rounded-full ${isSelected ? 'bg-white text-black shadow-md' : 'bg-white/10 text-white'}`}>
                        <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </div>

                  {/* Clip Details */}
                  <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                    <div>
                      <h4 className={`text-base font-bold truncate ${isSelected ? 'text-white' : 'text-white'}`}>
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
        <div className="mt-16 glass-panel border border-white/5 p-8 rounded-3xl border border-white/10 animate-fade-in-up">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="text-2xl font-black text-white flex items-center gap-3">
              <FileText className="w-6 h-6 text-white" />
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
        <button className="px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all text-sm font-bold text-white shadow-lg inline-flex items-center gap-3 hover:scale-105">
          <Download className="w-6 h-6" /> Download All Clips (.zip)
        </button>
      </div>

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black text-white">Publish Video</h2>
              <button onClick={() => setShowPublishModal(false)} className="text-gray-400 hover:text-white"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Platforms</label>
                <div className="flex flex-wrap gap-3">
                  {['youtube', 'tiktok', 'instagram', 'facebook', 'linkedin', 'x'].map(p => (
                    <button 
                      key={p}
                      onClick={() => {
                        const newPlatforms = publishForm.platforms.includes(p) 
                          ? publishForm.platforms.filter(x => x !== p) 
                          : [...publishForm.platforms, p];
                        setPublishForm({...publishForm, platforms: newPlatforms});
                      }}
                      className={`px-4 py-2 rounded-xl font-bold capitalize transition-all border ${publishForm.platforms.includes(p) ? 'bg-white/20 border-white text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Title</label>
                <input 
                  type="text" 
                  value={publishForm.title}
                  onChange={e => setPublishForm({...publishForm, title: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Description</label>
                <textarea 
                  rows={3}
                  value={publishForm.description}
                  onChange={e => setPublishForm({...publishForm, description: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-white focus:outline-none transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Hashtags</label>
                <input 
                  type="text" 
                  value={publishForm.hashtags}
                  onChange={e => setPublishForm({...publishForm, hashtags: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-white focus:outline-none transition-colors text-blue-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Schedule</label>
                <select 
                  value={publishForm.scheduled_time}
                  onChange={e => setPublishForm({...publishForm, scheduled_time: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-white focus:outline-none transition-colors"
                >
                  <option value="now">Post Immediately</option>
                  <option value={new Date(Date.now() + 3600000).toISOString()}>In 1 Hour</option>
                  <option value={new Date(Date.now() + 86400000).toISOString()}>Tomorrow</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-4 border-t border-white/10">
                <button onClick={() => setShowPublishModal(false)} className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white transition-all">Cancel</button>
                <button 
                  onClick={handlePublish}
                  disabled={isPublishing || publishForm.platforms.length === 0}
                  className="px-8 py-3 bg-white text-black rounded-xl font-black transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-2"
                >
                  {isPublishing ? 'Scheduling...' : 'Queue Posts'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Results;
