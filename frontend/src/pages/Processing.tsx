import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

const Processing = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState('Initializing AI Pipeline...');
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    if (!jobId) return;
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/jobs/${jobId}`);
        if (!response.ok) return;
        const data = await response.json();
        
        setStatusMessage(data.message || 'Processing...');
        setProgress(data.progress || 0);
        
        if (data.status === 'completed') {
          clearInterval(interval);
          setTimeout(() => navigate(`/results/${jobId}`), 1000);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setStatusMessage(data.message || 'Processing Failed');
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [jobId, navigate]);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center animate-fade-in-up mt-20">
      <div className="relative mb-16">
        <div className="w-40 h-40 rounded-full border-8 border-white/20 flex items-center justify-center relative">
          <div className="absolute inset-[-8px] rounded-full border-8 border-t-white border-r-transparent border-b-white border-l-transparent animate-spin"></div>
          <div className="bg-white p-6 rounded-3xl animate-pulse shadow-[0_0_50px_rgba(255,255,255,0.8)] text-black">
            <Sparkles className="w-12 h-12" />
          </div>
        </div>
      </div>
      
      <h2 className="text-5xl font-black text-white mb-6 drop-shadow-xl">AI Magic at Work</h2>
      <p className="text-2xl text-white/90 mb-12 font-bold animate-pulse drop-shadow-md">{statusMessage}</p>
      
      <div className="w-full glass-panel-dark rounded-full h-6 mb-4 overflow-hidden p-1">
        <div 
          className="bg-white h-full rounded-full transition-all duration-500 ease-out relative shadow-[0_0_20px_rgba(255,255,255,0.8)]"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-black/10 animate-[shimmer_2s_infinite]"></div>
        </div>
      </div>
      <div className="flex justify-between w-full text-lg text-white font-black px-4">
        <span className="drop-shadow-md">{progress}% Completed</span>
        {jobId && <span className="drop-shadow-md opacity-80">Job ID: {jobId}</span>}
      </div>
    </div>
  );
};

export default Processing;
