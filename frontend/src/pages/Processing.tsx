import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch, ApiError, errorMessage } from '../api';
import type { JobStatusResponse } from '../types';

const POLL_INTERVAL_MS = 2000;
// Keep retrying through brief outages (e.g. the AI service restarting) before giving up
const MAX_CONSECUTIVE_ERRORS = 15;

const Processing = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState('Initializing AI Pipeline...');
  const [progress, setProgress] = useState(0);
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState('Calculating...');
  const [connectionIssue, setConnectionIssue] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!jobId) return;

    const startTime = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveErrors = 0;

    const poll = async () => {
      try {
        const data = await apiFetch<JobStatusResponse>(`/api/jobs/${encodeURIComponent(jobId)}`);
        if (cancelled) return;
        consecutiveErrors = 0;
        setConnectionIssue('');

        if (data.status === 'failed') {
          setError(data.message || 'Processing failed');
          return;
        }

        const currentProgress = data.progress || 0;
        setProgress(currentProgress);
        setStatusMessage(data.message || 'Processing...');

        if (data.status === 'completed') {
          setEstimatedTimeLeft('Complete');
          timer = setTimeout(() => navigate(`/results/${jobId}`, { replace: true }), 1000);
          return;
        }

        if (currentProgress > 0 && currentProgress < 100) {
          const elapsedMs = Date.now() - startTime;
          const remainingSecs = Math.floor(((elapsedMs / currentProgress) * 100 - elapsedMs) / 1000);
          setEstimatedTimeLeft(remainingSecs <= 0 ? 'Almost done...' : remainingSecs > 60 ? `~${Math.ceil(remainingSecs / 60)} mins` : `~${remainingSecs} secs`);
        }
      } catch (err) {
        if (cancelled) return;
        consecutiveErrors += 1;
        const notFound = err instanceof ApiError && err.status === 404;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          setError(notFound ? 'This job could not be found.' : errorMessage(err, 'Lost connection to the server.'));
          return;
        }
        setConnectionIssue(notFound ? 'Waiting for the job to start...' : 'Connection problem, retrying...');
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, navigate, attempt]);

  if (error) {
    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center animate-fade-in-up mt-20 px-4">
        <div className="mb-10 text-red-500">
          <svg className="w-32 h-32 mx-auto drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-4xl font-bold text-white mb-4 drop-shadow-xl">Oops! Something went wrong.</h2>
        <p className="text-xl text-red-400 mb-10 font-bold drop-shadow-md" role="alert">{error}</p>

        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => { setError(''); setAttempt(a => a + 1); }}
            className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border border-white/20"
          >
            Check Again
          </button>
          <Link
            to="/"
            className="px-8 py-4 bg-white hover:bg-gray-200 text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:scale-105"
          >
            Return to Main Page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center text-center animate-fade-in-up mt-20 px-4">
      <div className="relative mb-16">
        <div className="w-40 h-40 rounded-full border-8 border-white/5 flex items-center justify-center relative">
          <div className="absolute inset-[-8px] rounded-full border-8 border-t-[#66fcf1] border-r-transparent border-b-[#66fcf1]/30 border-l-transparent animate-spin drop-shadow-[0_0_15px_rgba(102,252,241,0.5)]"></div>
          <div className="bg-black p-5 rounded-3xl border border-[#66fcf1]/30 animate-pulse shadow-[0_0_40px_rgba(102,252,241,0.3)] flex items-center justify-center relative z-10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#66fcf1]/10 to-transparent"></div>
            <img src="/logo.png" alt="ClipGenius Logo" className="w-14 h-14 rounded-xl object-contain relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
          </div>
        </div>
      </div>

      <h2 className="text-5xl font-bold text-white mb-6 drop-shadow-xl">AI Magic at Work</h2>
      <p className="text-2xl text-white/90 mb-4 font-bold animate-pulse drop-shadow-md" role="status">{statusMessage}</p>
      <p className="text-sm text-yellow-400 mb-8 h-5">{connectionIssue}</p>

      <div
        className="w-full glass-panel-dark rounded-full h-6 mb-4 overflow-hidden p-1"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="bg-white h-full rounded-full transition-all duration-500 ease-out relative shadow-[0_0_20px_rgba(255,255,255,0.8)] overflow-hidden"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-black/10 animate-shimmer"></div>
        </div>
      </div>
      <div className="flex justify-between items-center w-full text-lg text-white font-bold px-4 mb-4">
        <span className="drop-shadow-md">{progress}% Completed</span>
        {jobId && <span className="drop-shadow-md opacity-80 text-sm">Job ID: {jobId}</span>}
      </div>
      <div className="text-white font-bold text-lg">
        Estimated Time Left: {estimatedTimeLeft}
      </div>
    </div>
  );
};

export default Processing;
