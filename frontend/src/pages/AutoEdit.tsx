import { useState } from 'react';
import { UploadCloud, Link as LinkIcon, Sparkles, Video, Play, AlertTriangle, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, errorMessage } from '../api';
import { PageHeader, Panel } from '../components/ui';

const AutoEdit = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [layout, setLayout] = useState('9:16');
  const [style, setStyle] = useState('Cinematic');
  const [prompt, setPrompt] = useState('');
  const navigate = useNavigate();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!videoUrl && !file) return;

    if (videoUrl && !file) {
      try {
        const { protocol } = new URL(videoUrl);
        if (protocol !== 'http:' && protocol !== 'https:') throw new Error();
      } catch {
        setErrorMsg('Invalid URL. Please enter a valid HTTP/HTTPS URL.');
        return;
      }
    }

    setSubmitting(true);
    try {
      let body: FormData | string;
      if (file) {
        const formData = new FormData();
        formData.append('video', file);
        formData.append('layout', layout);
        formData.append('style', style);
        formData.append('prompt', prompt);
        body = formData;
      } else {
        body = JSON.stringify({ videoUrl, layout, style, prompt });
      }

      const data = await apiFetch<{ jobId: string }>('/api/auto-edit', { method: 'POST', body });
      navigate(`/processing/${data.jobId}`);
    } catch (error) {
      setErrorMsg(errorMessage(error, 'Failed to submit the job.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell animate-fade-in-up max-w-3xl mx-auto">
      <PageHeader
        title="AI Auto Video Editor"
        subtitle="Upload a raw video and let AI cut it into a tight story with zooms, color grading and animated subtitles."
      />

      <Panel className="p-6 sm:p-8">
        <h2 className="font-display text-lg font-bold text-[var(--color-ink)] mb-6 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--color-accent)]" aria-hidden="true" />
          Configure Editing Job
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMsg && (
            <div className="alert-error" role="alert">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              {errorMsg}
            </div>
          )}

          <div>
            <label htmlFor="auto-video-url" className="field-label">
              <span className="inline-flex items-center gap-1.5"><LinkIcon className="w-3 h-3" aria-hidden="true" /> Raw Video URL</span>
            </label>
            <input
              id="auto-video-url"
              disabled={Boolean(file)}
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder={file ? 'Remove the file to use a URL' : 'https://www.youtube.com/watch?v=...'}
              className="field-input"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--color-border)]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-faint)]">or</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          <div
            className={`relative flex flex-col items-center justify-center p-7 border border-dashed rounded-[10px] transition-colors cursor-pointer
              ${dragActive
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                : 'border-[var(--color-border-strong)] bg-[var(--color-canvas)] hover:border-[var(--color-muted)]'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              id="file-upload"
              type="file"
              aria-label="Choose a video file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              accept="video/*"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setVideoUrl(''); }}
            />
            <UploadCloud className="w-6 h-6 text-[var(--color-muted)] mb-2" aria-hidden="true" />
            <p className="text-sm font-medium text-[var(--color-ink)]">{file ? file.name : 'Drop a video here'}</p>
            <p className="text-xs text-[var(--color-faint)] mt-1">
              {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : 'MP4 or MOV · up to 2 GB'}
            </p>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="relative z-20 mt-3 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" aria-hidden="true" /> Remove
              </button>
            )}
          </div>

          <fieldset>
            <legend className="field-label">
              <span className="inline-flex items-center gap-1.5"><Video className="w-3 h-3" aria-hidden="true" /> Target Aspect Ratio</span>
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: '9:16', title: '9:16 Vertical', subtitle: 'TikTok · Reels · Shorts' },
                { id: '16:9', title: '16:9 Landscape', subtitle: 'YouTube · web' },
                { id: '1:1', title: '1:1 Square', subtitle: 'Instagram post' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={layout === option.id}
                  onClick={() => setLayout(option.id)}
                  className={`py-3 px-3 rounded-[10px] border text-left transition-colors
                    ${layout === option.id
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                      : 'border-[var(--color-border)] bg-[var(--color-canvas)] hover:border-[var(--color-border-strong)]'}`}
                >
                  <span className="block text-sm font-semibold text-[var(--color-ink)]">{option.title}</span>
                  <span className="block text-[11px] text-[var(--color-faint)] mt-0.5">{option.subtitle}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="auto-style" className="field-label">
              <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3 h-3" aria-hidden="true" /> Editing Style</span>
            </label>
            <select
              id="auto-style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="field-input"
            >
              <option value="Cinematic">Cinematic</option>
              <option value="Viral Reels">Viral Reels</option>
              <option value="TikTok">TikTok</option>
              <option value="Podcast">Podcast</option>
              <option value="Motivational">Motivational</option>
              <option value="Vlog">Vlog</option>
              <option value="Gaming">Gaming</option>
            </select>
          </div>

          <div>
            <label htmlFor="auto-prompt" className="field-label">Custom Prompt (Optional)</label>
            <textarea
              id="auto-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Keep only the funniest moments and focus on the product demo."
              className="field-input min-h-[100px] resize-y"
            />
          </div>

          <button type="submit" disabled={(!videoUrl && !file) || submitting} className="btn-primary w-full py-3.5">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Play className="w-4 h-4 fill-current" aria-hidden="true" />}
            {submitting ? (file ? 'Uploading…' : 'Starting…') : 'Start Auto Edit'}
          </button>
        </form>
      </Panel>
    </div>
  );
};

export default AutoEdit;
