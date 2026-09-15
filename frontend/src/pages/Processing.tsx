import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { apiFetch, ApiError, errorMessage } from '../api';
import type { JobStatusResponse } from '../types';

const POLL_INTERVAL_MS = 2000;
const MAX_CONSECUTIVE_ERRORS = 15;

const Processing = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState('Initializing pipeline…');
  const [progress, setProgress] = useState(0);
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState('Calculating…');
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
        setStatusMessage(data.message || 'Processing…');

        if (data.status === 'completed') {
          setEstimatedTimeLeft('Complete');
          timer = setTimeout(() => navigate(`/results/${jobId}`, { replace: true }), 1000);
          return;
        }

        if (currentProgress > 0 && currentProgress < 100) {
          const elapsedMs = Date.now() - startTime;
          const remainingSecs = Math.floor(((elapsedMs / currentProgress) * 100 - elapsedMs) / 1000);
          setEstimatedTimeLeft(
            remainingSecs <= 0 ? 'Almost done…'
              : remainingSecs > 60 ? `~${Math.ceil(remainingSecs / 60)} min`
              : `~${remainingSecs}s`
          );
        }
      } catch (err) {
        if (cancelled) return;
        consecutiveErrors += 1;
        const notFound = err instanceof ApiError && err.status === 404;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          setError(notFound ? 'This job could not be found.' : errorMessage(err, 'Lost connection to the server.'));
          return;
        }
        setConnectionIssue(notFound ? 'Waiting for the job to start…' : 'Connection problem, retrying…');
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
      <div className="page-shell max-w-lg mx-auto text-center animate-fade-in-up pt-16">
        <div className="panel p-8">
          <h2 className="page-title mb-3">Processing failed</h2>
          <p className="text-[var(--color-danger)] mb-8 font-medium" role="alert">{error}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button type="button" onClick={() => { setError(''); setAttempt((a) => a + 1); }} className="btn-secondary">
              Check again
            </button>
            <Link to="/" className="btn-primary">Back to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell max-w-lg mx-auto text-center animate-fade-in-up pt-12">
      <div className="panel p-8 sm:p-10">
        <div className="mx-auto mb-8 w-14 h-14 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-[var(--color-accent)] animate-spin" aria-hidden="true" />
        </div>

        <h2 className="font-display text-2xl font-bold text-[var(--color-ink)] mb-2 tracking-tight">Rendering your clips</h2>
        <p className="text-[var(--color-muted)] mb-2 font-medium" role="status">{statusMessage}</p>
        <p className="text-sm text-[var(--color-warn)] h-5 mb-8">{connectionIssue}</p>

        <div
          className="w-full h-2 rounded-full bg-[var(--color-canvas)] border border-[var(--color-border)] overflow-hidden mb-4"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between text-sm font-semibold text-[var(--color-ink)] mb-2">
          <span>{progress}%</span>
          <span className="text-[var(--color-muted)] font-medium">{estimatedTimeLeft}</span>
        </div>
        {jobId && (
          <p className="text-[11px] text-[var(--color-faint)] font-mono mt-4 truncate" title={jobId}>
            Job {jobId}
          </p>
        )}
      </div>
    </div>
  );
};

export default Processing;
