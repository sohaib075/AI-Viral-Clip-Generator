import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { apiFetch, ApiError, errorMessage } from '../api';
import type { JobStatusResponse, HighlightData } from '../types';

const POLL_INTERVAL_MS = 2000;
const MAX_CONSECUTIVE_ERRORS = 15;

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const Processing = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState('Initializing pipeline…');
  const [progress, setProgress] = useState(0);
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState('Calculating…');
  const [connectionIssue, setConnectionIssue] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  // Human Approval State
  const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);
  const [highlights, setHighlights] = useState<HighlightData[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [videoTitle, setVideoTitle] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

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

        if (data.status === 'awaiting_approval') {
          setIsAwaitingApproval(true);
          if (data.highlights && data.highlights.length > 0) {
            setHighlights(data.highlights);
            setSelectedIndices((prev) => (prev.size === 0 ? new Set(data.highlights!.map((_, i) => i)) : prev));
          }
          if (data.source_title || data.title) {
            setVideoTitle(data.source_title || data.title || '');
          }
          setStatusMessage(data.message || 'Waiting for human review and approval…');
          setProgress(data.progress || 70);
          // Keep polling at relaxed interval in case approved from another tab
          timer = setTimeout(poll, 4000);
          return;
        }

        // If no longer awaiting approval, ensure approval UI is closed
        setIsAwaitingApproval(false);

        const currentProgress = data.progress || 0;
        setProgress(currentProgress);
        setStatusMessage(data.message || 'Processing…');

        if (data.status === 'completed') {
          setEstimatedTimeLeft('Complete');
          timer = setTimeout(() => navigate(`/results/${jobId}`, { replace: true }), 1000);
          return;
        }

        if (currentProgress > 0 && currentProgress < 100) {
          if (data.message?.includes('Capturing live')) {
            setEstimatedTimeLeft('Recording stream…');
          } else {
            const elapsedMs = Date.now() - startTime;
            const remainingSecs = Math.floor(((elapsedMs / currentProgress) * 100 - elapsedMs) / 1000);
            setEstimatedTimeLeft(
              remainingSecs <= 0 ? 'Almost done…'
                : remainingSecs > 60 ? `~${Math.ceil(remainingSecs / 60)} min`
                : `~${remainingSecs}s`
            );
          }
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

  const toggleSelection = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIndices(new Set(highlights.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedIndices(new Set());
  };

  const handleApprove = async () => {
    if (selectedIndices.size === 0 || isSubmittingApproval || !jobId) return;
    setIsSubmittingApproval(true);
    try {
      const selectedHighlights = Array.from(selectedIndices)
        .sort((a, b) => a - b)
        .map((i) => highlights[i]);

      await apiFetch(`/api/jobs/${encodeURIComponent(jobId)}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvedHighlights: selectedHighlights })
      });

      setIsAwaitingApproval(false);
      setProgress(75);
      setStatusMessage(`Approved ${selectedHighlights.length} clip(s). Rendering…`);
      setAttempt((a) => a + 1);
    } catch (err) {
      setError(errorMessage(err, 'Failed to submit approval'));
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleReject = async () => {
    if (!jobId || isSubmittingApproval) return;
    if (!window.confirm('Are you sure you want to cancel this job?')) return;
    setIsSubmittingApproval(true);
    try {
      await apiFetch(`/api/jobs/${encodeURIComponent(jobId)}/reject`, {
        method: 'POST'
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Failed to cancel job'));
    } finally {
      setIsSubmittingApproval(false);
    }
  };

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

  // Human Approval Screen
  if (isAwaitingApproval && highlights.length > 0) {
    return (
      <div className="page-shell max-w-5xl mx-auto animate-fade-in-up pt-6 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Human Approval Required
            </div>
            <h1 className="page-title text-2xl sm:text-3xl">Review Viral Highlights</h1>
            <p className="page-subtitle text-sm sm:text-base mt-1">
              Gemini analyzed{' '}
              <span className="text-[var(--color-ink)] font-semibold">{videoTitle || 'your video'}</span> and found{' '}
              <span className="text-[var(--color-accent)] font-bold">{highlights.length} viral highlights</span>.
              Select the clips you want to render into vertical shorts.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-ink)] font-medium transition"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-muted)] font-medium transition"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Highlight Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {highlights.map((item, idx) => {
            const isSelected = selectedIndices.has(idx);
            const duration = Math.max(1, Math.round((item.end_time || 0) - (item.start_time || 0)));
            return (
              <div
                key={idx}
                onClick={() => toggleSelection(idx)}
                className={`panel p-5 cursor-pointer transition-all duration-200 border-2 select-none relative ${
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-surface-2)] shadow-lg shadow-[var(--color-accent-soft)]'
                    : 'border-[var(--color-border)] opacity-60 hover:opacity-90 hover:border-[var(--color-border-strong)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // parent onClick handles toggle
                      className="w-5 h-5 rounded border-[var(--color-border-strong)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] cursor-pointer"
                    />
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)]">
                      #{idx + 1}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">
                    🔥 Virality: {item.score}/100
                  </span>
                </div>

                <h3 className="font-semibold text-[var(--color-ink)] text-base mb-2 leading-snug">
                  {item.title}
                </h3>

                <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] mb-3">
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-[var(--color-faint)]" />
                    {formatSeconds(item.start_time || 0)} – {formatSeconds(item.end_time || 0)}
                  </span>
                  <span>•</span>
                  <span>{duration}s duration</span>
                </div>

                {item.reasoning && (
                  <p className="text-xs text-[var(--color-muted)] bg-[var(--color-surface)] p-2.5 rounded-lg border border-[var(--color-border)] line-clamp-2 italic mb-2">
                    &ldquo;{item.reasoning}&rdquo;
                  </p>
                )}

                {item.emphasized_words && item.emphasized_words.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Sparkles className="w-3 h-3 text-[var(--color-accent)]" />
                    {item.emphasized_words.map((w, wi) => (
                      <span
                        key={wi}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[var(--color-surface)] text-[var(--color-faint)] border border-[var(--color-border)]"
                      >
                        #{w}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sticky Action Footer */}
        <div className="sticky bottom-4 panel p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-[var(--color-border-strong)] bg-[var(--color-surface)]/95 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <span className="font-bold text-[var(--color-accent)] text-lg">{selectedIndices.size}</span>
            <span className="text-[var(--color-muted)]">of {highlights.length} clips selected for rendering</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleReject}
              disabled={isSubmittingApproval}
              className="btn-secondary text-sm py-2 px-4 hover:border-red-500/50 hover:text-red-400 transition"
            >
              Cancel Job
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={selectedIndices.size === 0 || isSubmittingApproval}
              className="btn-primary text-sm py-2.5 px-6 flex items-center gap-2"
            >
              {isSubmittingApproval ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Starting Renderer…</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve & Render ({selectedIndices.size})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Regular Progress Screen
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
