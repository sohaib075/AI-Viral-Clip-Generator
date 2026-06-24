import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

const Processing = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState('Initializing AI Pipeline...');
  const [progress, setProgress] = useState(0);
  const [startTime] = useState(Date.now());
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState('Calculating...');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/jobs/${jobId}`);
        if (!response.ok) return;
        const data = await response.json();
        
        setStatusMessage(data.message || 'Processing...');
        const currentProgress = data.progress || 0;
        setProgress(currentProgress);
        
        if (currentProgress > 0 && currentProgress < 100) {
          const elapsedMs = Date.now() - startTime;
          const estimatedTotalMs = (elapsedMs / currentProgress) * 100;
          const remainingMs = estimatedTotalMs - elapsedMs;
          
          if (remainingMs > 0) {
            const remainingSecs = Math.floor(remainingMs / 1000);
            if (remainingSecs > 60) {
              setEstimatedTimeLeft(`~${Math.ceil(remainingSecs / 60)} mins`);
            } else {
              setEstimatedTimeLeft(`~${remainingSecs} secs`);
            }
          } else {
            setEstimatedTimeLeft('Almost done...');
          }
        } else if (currentProgress >= 100 || data.status === 'completed') {
          setEstimatedTimeLeft('Complete');
        }

        if (data.status === 'completed') {
          clearInterval(interval);
          setTimeout(() => navigate(`/results/${jobId}`), 1000);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setStatusMessage(data.message || 'Processing Failed');
          setEstimatedTimeLeft('Failed');
          setHasError(true);
        }
      } catch (e) {
        console.error("Polling error", e);
        clearInterval(interval);
        setStatusMessage('Network Error occurred while polling');
        setEstimatedTimeLeft('Failed');
        setHasError(true);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [jobId, navigate, startTime]);

  if (hasError) {
    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center animate-fade-in-up mt-20">
        <div className="mb-10 text-red-500">
          <svg className="w-32 h-32 mx-auto drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-4xl font-black text-white mb-4 drop-shadow-xl">Oops! Something went wrong.</h2>
        <p className="text-xl text-red-400 mb-10 font-bold drop-shadow-md">{statusMessage}</p>
        
        <button 
          onClick={() => navigate('/')} 
          className="px-8 py-4 bg-white hover:bg-gray-200 text-black font-black rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:scale-105"
        >
          Return to Main Page
        </button>
      </div>
    );
  }

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
      <div className="flex justify-between items-center w-full text-lg text-white font-black px-4 mb-4">
        <span className="drop-shadow-md">{progress}% Completed</span>
        {jobId && <span className="drop-shadow-md opacity-80 text-sm">Job ID: {jobId}</span>}
      </div>
      <div className="text-[#66fcf1] font-bold text-lg animate-pulse">
        Estimated Time Left: {estimatedTimeLeft}
      </div>
    </div>
  );
};

export default Processing;
