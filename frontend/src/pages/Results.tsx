import React, { useState, useEffect } from 'react';
import { CheckCircle, Play, Share2, Download, ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

interface ClipResult {
  id: string;
  url: string;
  title: string;
  duration: string;
  score: number;
}

const Results = () => {
  const { jobId } = useParams();
  const [clips, setClips] = useState<ClipResult[]>([]);

  useEffect(() => {
    // In a real app, fetch results using jobId
    // Mock data:
    setClips([
      { id: '1', url: '#', title: 'The Key to Success', duration: '00:45', score: 98 },
      { id: '2', url: '#', title: 'Unbelievable Story', duration: '00:30', score: 92 },
      { id: '3', url: '#', title: 'Important Lesson', duration: '00:55', score: 85 },
    ]);
  }, [jobId]);

  return (
    <div className="w-full max-w-7xl mx-auto animate-fade-in-up mt-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6 bg-black/20 p-8 rounded-3xl backdrop-blur-md border border-white/10">
        <div>
          <h2 className="text-5xl font-black text-white mb-3 flex items-center gap-4 drop-shadow-xl">
            <CheckCircle className="w-10 h-10 text-green-400" />
            Your Viral Clips
          </h2>
          <p className="text-xl text-white/80 font-bold">We identified {clips.length} highly engaging moments.</p>
        </div>
        <Link 
          to="/"
          className="flex items-center gap-2 px-6 py-4 rounded-xl bg-white hover:bg-gray-100 text-black text-lg font-black shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5" /> Convert Another Video
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
        {clips.map((clip, index) => (
          <div 
            key={clip.id} 
            className="group relative glass-panel-dark rounded-3xl overflow-hidden hover:border-white transition-all duration-500 hover:shadow-[0_0_50px_rgba(255,255,255,0.3)] hover:-translate-y-2 animate-fade-in-up border-2 border-white/20"
            style={{ animationDelay: `${index * 0.15 + 0.2}s`, opacity: 0, animationFillMode: 'forwards' }}
          >
            <div className="aspect-[9/16] bg-black relative overflow-hidden flex items-center justify-center border-b-2 border-white/20">
              <img 
                src={`https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&auto=format&fit=crop&q=80&ixlib=rb-4.0.3`}
                alt="Thumbnail" 
                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-110 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30"></div>
              
              <button className="w-20 h-20 bg-white backdrop-blur-md rounded-full flex items-center justify-center text-black group-hover:scale-110 transition-transform z-10 shadow-[0_0_30px_rgba(255,255,255,0.5)]">
                <Play className="w-8 h-8 ml-1" fill="currentColor" />
              </button>
              
              <div className="absolute bottom-5 right-5 bg-white text-black px-3 py-1.5 rounded-lg text-sm font-black shadow-lg">
                {clip.duration}
              </div>
            </div>

            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-black text-white leading-tight line-clamp-2 drop-shadow-md">
                  {clip.title}
                </h3>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-white/60 font-black uppercase tracking-wider mb-1">Virality Score</span>
                  <div className="flex items-center gap-1 bg-yellow-400 text-black px-3 py-1 rounded-lg text-lg font-black shadow-[0_0_15px_rgba(253,224,71,0.6)]">
                    {clip.score}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 mt-8">
                <button className="flex-1 flex items-center justify-center gap-2 py-4 glass-panel hover:bg-white/20 rounded-xl transition-colors text-base font-bold text-white border-white/30">
                  <Share2 className="w-5 h-5" /> Share
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-4 bg-white hover:bg-gray-200 text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] rounded-xl transition-colors text-base font-black">
                  <Download className="w-5 h-5" /> Download
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-16 text-center pb-10">
        <button className="px-10 py-5 bg-black/40 hover:bg-black/60 backdrop-blur-xl border-2 border-white/30 rounded-2xl transition-colors text-lg font-black text-white shadow-xl inline-flex items-center gap-3 hover:scale-105">
          <Download className="w-6 h-6" /> Download All Clips (.zip)
        </button>
      </div>
    </div>
  );
};

export default Results;
