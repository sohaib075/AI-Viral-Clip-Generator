import { useState, useEffect } from 'react';
import { BookOpen, Play, CheckCircle2, Loader2, Sparkles, AlertCircle, Video, Download } from 'lucide-react';
import { apiFetch, ApiError, errorMessage, mediaUrl } from '../api';
import { downloadFile, fileNameFromUrl } from '../utils';
import { PageHeader, Panel } from '../components/ui';
import type { JobStatusResponse } from '../types';

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
    setVideoUrl(null);
    setStatus('processing');
    setProgress(5);
    setMessage('Submitting your story...');

    try {
      const data = await apiFetch<{ jobId: string }>('/api/story-to-video', {
        method: 'POST',
        body: JSON.stringify({ story, style, voice, aspectRatio }),
      });
      setJobId(data.jobId);
    } catch (err) {
      setStatus('error');
      setErrorMsg(errorMessage(err, 'Failed to start the job.'));
    }
  };

  useEffect(() => {
    if (!jobId || status !== 'processing') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveErrors = 0;

    const poll = async () => {
      try {
        const data = await apiFetch<JobStatusResponse>(`/api/jobs/${encodeURIComponent(jobId)}`);
        if (cancelled) return;
        consecutiveErrors = 0;

        if (data.status === 'completed') {
          setStatus('completed');
          setProgress(100);
          setMessage('Video generation complete!');
          setVideoUrl(mediaUrl(data.clips?.[0]?.video_url));
          return;
        }
        if (data.status === 'failed') {
          setStatus('error');
          setErrorMsg(data.message || 'Job failed');
          return;
        }
        setProgress(data.progress || 10);
        setMessage(data.message || 'Processing...');
      } catch (e) {
        if (cancelled) return;
        // Tolerate brief hiccups, but don't spin forever if the server stays unreachable
        consecutiveErrors += 1;
        const limit = e instanceof ApiError && e.status === 404 ? 10 : 5;
        if (consecutiveErrors >= limit) {
          setStatus('error');
          setErrorMsg(errorMessage(e, 'Lost connection to the server.'));
          return;
        }
      }
      timer = setTimeout(poll, 2000);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, status]);

  return (
    <div className="page-shell animate-fade-in-up max-w-6xl mx-auto">
      <PageHeader
        title="AI Story to Video"
        subtitle="Paste your novel chapter, script, or story idea below. Our AI will automatically break it into scenes, generate visual prompts, create narration, and render a complete video."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Panel className="p-6">
            <h2 className="font-display text-lg font-bold text-[var(--color-ink)] mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--color-accent)]" aria-hidden="true" />
              Your Story
            </h2>

            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Once upon a time in a cyberpunk city..."
              className="field-input h-64 resize-none"
              disabled={status === 'processing'}
            />

            {errorMsg && status !== 'error' && (
              <div className="alert-error mt-4" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                {errorMsg}
              </div>
            )}
          </Panel>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Panel className="p-4">
              <label htmlFor="story-style" className="field-label">Video Style</label>
              <select
                id="story-style"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                disabled={status === 'processing'}
                className="field-input"
              >
                <option value="Cinematic">Cinematic</option>
                <option value="Anime">Anime</option>
                <option value="Realistic">Realistic</option>
                <option value="Cyberpunk">Cyberpunk</option>
                <option value="Cartoon">Cartoon</option>
                <option value="Watercolor">Watercolor</option>
                <option value="3D Animation">3D Animation</option>
              </select>
            </Panel>

            <Panel className="p-4">
              <label htmlFor="story-aspect" className="field-label">Aspect Ratio</label>
              <select
                id="story-aspect"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                disabled={status === 'processing'}
                className="field-input"
              >
                <option value="9:16">Vertical (9:16) - Shorts/TikTok</option>
                <option value="16:9">Horizontal (16:9) - YouTube</option>
                <option value="1:1">Square (1:1) - Instagram</option>
              </select>
            </Panel>

            <Panel className="p-4">
              <label htmlFor="story-voice" className="field-label">Narration Voice</label>
              <select
                id="story-voice"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                disabled={status === 'processing'}
                className="field-input"
              >
                <option value="en-US-ChristopherNeural">Christopher (Deep Male)</option>
                <option value="en-US-AriaNeural">Aria (Clear Female)</option>
                <option value="en-US-GuyNeural">Guy (Friendly Male)</option>
                <option value="en-GB-SoniaNeural">Sonia (British Female)</option>
              </select>
            </Panel>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={status === 'processing'}
            className="btn-primary w-full py-3.5"
          >
            {status === 'processing' ? (
              <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Generating...</>
            ) : (
              <><Play className="w-5 h-5" fill="currentColor" aria-hidden="true" /> Generate Video</>
            )}
          </button>
        </div>

        <Panel className="p-6 min-h-[400px] flex flex-col">
          <h2 className="font-display text-lg font-bold text-[var(--color-ink)] mb-6 flex items-center gap-2 border-b border-[var(--color-border)] pb-4">
            <Video className="w-5 h-5 text-[var(--color-accent)]" aria-hidden="true" />
            Generation Status
          </h2>

          {status === 'idle' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--color-faint)] gap-4">
              <BookOpen className="w-12 h-12 opacity-40" aria-hidden="true" />
              <p className="text-sm">Enter a story and click generate to see the magic happen.</p>
            </div>
          )}

          {status === 'processing' && (
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-[var(--color-accent)]">{message}</span>
                <span className="text-[var(--color-ink)]">{progress}%</span>
              </div>
              <div className="h-2 bg-[var(--color-canvas)] rounded-full overflow-hidden border border-[var(--color-border)]">
                <div
                  className="h-full bg-[var(--color-accent)] transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-8 text-center text-xs text-[var(--color-muted)]">
                The AI is breaking your story into scenes, painting the visuals, and recording the narration. This usually takes 1-3 minutes.
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4" role="alert">
              <AlertCircle className="w-12 h-12 text-[var(--color-danger)]" aria-hidden="true" />
              <p className="text-sm text-[var(--color-danger)]">{errorMsg || 'The video could not be generated.'}</p>
            </div>
          )}

          {status === 'completed' && !videoUrl && (
            <p className="text-sm text-[var(--color-danger)]" role="alert">The job finished but returned no video.</p>
          )}

          {status === 'completed' && videoUrl && (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-2 text-[var(--color-ok)] mb-4 bg-[rgba(61,154,106,0.12)] p-3 rounded-[10px] border border-[rgba(61,154,106,0.35)]">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                <span className="text-sm font-medium">Video successfully generated!</span>
              </div>
              <div className={`relative w-full bg-[var(--color-canvas)] rounded-[10px] overflow-hidden border border-[var(--color-border)] mx-auto ${aspectRatio === '16:9' ? 'aspect-video' : aspectRatio === '1:1' ? 'aspect-square max-w-[320px]' : 'aspect-[9/16] max-w-[280px]'}`}>
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => downloadFile(videoUrl, fileNameFromUrl(videoUrl))}
                className="btn-secondary mt-6 w-full"
              >
                <Download className="w-4 h-4" aria-hidden="true" /> Download Video
              </button>
              {jobId && (
                <button
                  type="button"
                  onClick={() => { setStatus('idle'); setJobId(null); setVideoUrl(null); setProgress(0); }}
                  className="btn-ghost mt-3 w-full text-sm"
                >
                  Create another video
                </button>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default StoryToVideo;
