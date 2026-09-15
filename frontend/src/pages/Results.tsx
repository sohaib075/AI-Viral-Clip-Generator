import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { CheckCircle, Play, Download, ArrowLeft, FileText, Copy, Sliders, Type, Palette, Move, Camera, MessageCircle, Briefcase, Video, Loader, Globe, X, AlertTriangle, Film } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch, errorMessage, mediaUrl } from '../api';
import { copyText, downloadFile, fileNameFromUrl, formatDuration } from '../utils';
import { PLATFORMS, platformName, type Account, type ClipData, type JobStatusResponse, type PlatformCopy, type WordTiming } from '../types';

interface ClipResult {
  id: string;
  url: string;
  baseUrl: string | null;
  title: string;
  duration: string | null;
  startTime: number;
  endTime?: number;
  score: number | null;
  reasoning: string;
  words: WordTiming[];
  metadata: Record<string, PlatformCopy>;
  layout: string;
  thumbnail: string | null;
  source: ClipData;
}

interface StyleConfig {
  theme: string;
  fontName: string;
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  marginV: number;
}

type Shape = 'vertical' | 'horizontal' | 'square';

const shapeOf = (layout: string): Shape =>
  layout === 'horizontal' || layout === '16:9' ? 'horizontal' : layout === '1:1' ? 'square' : 'vertical';

// Caption canvas height used by the renderer (ASS PlayResY) for each shape
const PLAY_RES_Y: Record<Shape, number> = { vertical: 1920, horizontal: 1080, square: 1080 };
const ASPECT_CLASS: Record<Shape, string> = { vertical: 'aspect-[9/16] max-w-[320px]', horizontal: 'aspect-video max-w-[640px]', square: 'aspect-square max-w-[420px]' };

// ASS colors are &HAABBGGRR
const COLORS = [
  { name: 'White', ass: '&H00FFFFFF', css: '#ffffff' },
  { name: 'Yellow', ass: '&H0000FFFF', css: '#ffff00' },
  { name: 'Green', ass: '&H0000FF00', css: '#00ff00' },
  { name: 'Blue', ass: '&H00FF0000', css: '#0000ff' },
  { name: 'Red', ass: '&H000000FF', css: '#ff0000' },
];
const cssColor = (ass: string) => COLORS.find(c => c.ass === ass)?.css ?? '#ffffff';

const THEMES: Record<string, { label: string; fontName: string; primaryColor: string; highlightColor: string; sizeScale: number }> = {
  Modern: { label: 'Modern (Bold & Clean)', fontName: 'Arial Black', primaryColor: '&H00FFFFFF', highlightColor: '&H0000FFFF', sizeScale: 1 },
  Viral: { label: 'Viral (Big Yellow Highlights)', fontName: 'Arial Black', primaryColor: '&H00FFFFFF', highlightColor: '&H0000FFFF', sizeScale: 1.2 },
  Podcast: { label: 'Podcast (Minimal & Professional)', fontName: 'Arial', primaryColor: '&H00FFFFFF', highlightColor: '&H0000FF00', sizeScale: 0.8 },
  Gaming: { label: 'Gaming (High Contrast)', fontName: 'Verdana', primaryColor: '&H0000FFFF', highlightColor: '&H0000FF00', sizeScale: 1 },
};

// Same defaults the renderer uses for each shape
const defaultStyle = (shape: Shape, theme = 'Modern'): StyleConfig => {
  const preset = THEMES[theme];
  const vertical = shape === 'vertical';
  return {
    theme,
    fontName: preset.fontName,
    fontSize: Math.round((vertical ? 64 : 44) * preset.sizeScale),
    primaryColor: preset.primaryColor,
    highlightColor: preset.highlightColor,
    marginV: vertical ? 500 : 80,
  };
};

const SOCIAL_CARDS: { key: string; label: string; icon: ReactNode }[] = [
  { key: 'tiktok', label: 'TikTok', icon: <Video className="w-6 h-6" /> },
  { key: 'instagram', label: 'Instagram', icon: <Camera className="w-6 h-6" /> },
  { key: 'youtube_shorts', label: 'YouTube Shorts', icon: <Film className="w-6 h-6" /> },
  { key: 'x', label: 'X', icon: <MessageCircle className="w-6 h-6" /> },
  { key: 'linkedin', label: 'LinkedIn (copy only)', icon: <Briefcase className="w-6 h-6" /> },
];

const copyFromMetadata = (copy: PlatformCopy) =>
  [copy.title, copy.description ?? copy.post ?? copy.tweet, copy.hashtags?.map(h => `#${h.replace(/^#/, '')}`).join(' ')]
    .filter(Boolean)
    .join('\n');

const toClip = (c: ClipData, index: number): ClipResult => {
  const startTime = typeof c.start_time === 'number' ? c.start_time : 0;
  const duration = typeof c.end_time === 'number' ? formatDuration(c.end_time - startTime) : null;
  return {
    id: String(index),
    url: mediaUrl(c.video_url) || '',
    baseUrl: mediaUrl(c.base_url),
    title: c.title || `Clip ${index + 1}`,
    duration,
    startTime,
    endTime: c.end_time,
    score: typeof c.score === 'number' && c.score > 0 ? c.score : null,
    reasoning: c.reasoning || '',
    words: c.words || [],
    metadata: c.metadata || {},
    layout: c.layout || 'vertical',
    thumbnail: mediaUrl(c.thumbnail_url),
    source: c,
  };
};

type ScheduleChoice = 'now' | 'hour' | 'tomorrow' | 'custom';

const scheduledTimeFor = (choice: ScheduleChoice, custom: string) => {
  if (choice === 'hour') return new Date(Date.now() + 3600000).toISOString();
  if (choice === 'tomorrow') return new Date(Date.now() + 86400000).toISOString();
  if (choice === 'custom') return custom ? new Date(custom).toISOString() : '';
  return 'now';
};

const CopyButton = ({ text, label = 'Copy' }: { text: string; label?: string }) => {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <button
      type="button"
      className="mt-3 text-xs bg-[var(--color-canvas)] hover:border-[var(--color-border-strong)] border border-[var(--color-border)] px-3 py-1.5 rounded-md flex items-center gap-1 font-bold text-[var(--color-ink)] transition-colors"
      onClick={async () => {
        setState((await copyText(text)) ? 'copied' : 'failed');
        setTimeout(() => setState('idle'), 2000);
      }}
    >
      <Copy className="w-3 h-3" aria-hidden="true" /> {state === 'copied' ? 'Copied!' : state === 'failed' ? 'Copy failed' : label}
    </button>
  );
};

const Results = () => {
  const { jobId } = useParams();
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'processing' | 'failed' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [clips, setClips] = useState<ClipResult[]>([]);
  const [transcript, setTranscript] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [activeClip, setActiveClip] = useState<ClipResult | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<'final_clip' | 'customizer' | 'metadata'>('final_clip');
  const [styleConfig, setStyleConfig] = useState<StyleConfig>(defaultStyle('vertical'));

  // Export results per clip; an export that finishes after switching clips is kept for its own clip
  const [exportingClipId, setExportingClipId] = useState<string | null>(null);
  const [exportedAt, setExportedAt] = useState<Record<string, number>>({});
  const [exportError, setExportError] = useState('');

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [publishForm, setPublishForm] = useState({ title: '', description: '', hashtags: '', platforms: [] as string[] });
  const [schedule, setSchedule] = useState<ScheduleChoice>('now');
  const [customTime, setCustomTime] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ ok: boolean; message: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<JobStatusResponse>(`/api/jobs/${encodeURIComponent(jobId)}`);
        if (cancelled) return;
        if (data.status === 'processing') return setLoadState('processing');
        if (data.status === 'failed') {
          setLoadError(data.message || 'This job failed.');
          return setLoadState('failed');
        }
        const mapped = (data.clips || []).map(toClip);
        setClips(mapped);
        setTranscript(data.transcript || '');
        setWarnings(data.warnings || []);
        const first = mapped[0] ?? null;
        setActiveClip(first);
        if (first) setStyleConfig(defaultStyle(shapeOf(first.layout)));
        setLoadState('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(errorMessage(err, 'Could not load the results.'));
        setLoadState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  const selectClip = (clip: ClipResult | null) => {
    setActiveClip(clip);
    setExportError('');
    setCurrentTime(0);
    if (clip) {
      setStyleConfig(defaultStyle(shapeOf(clip.layout)));
      if (activeTab === 'customizer' && !clip.baseUrl) setActiveTab('final_clip');
    }
  };

  const shape = shapeOf(activeClip?.layout || 'vertical');
  const finalUrl = activeClip
    ? `${activeClip.url}${exportedAt[activeClip.id] ? `${activeClip.url.includes('?') ? '&' : '?'}v=${exportedAt[activeClip.id]}` : ''}`
    : '';

  const handleExport = async () => {
    if (!activeClip?.baseUrl) return;
    const clip = activeClip;
    setExportingClipId(clip.id);
    setExportError('');
    try {
      await apiFetch<{ success: boolean; export_url: string }>('/api/export', {
        method: 'POST',
        timeoutMs: 10 * 60 * 1000,
        body: JSON.stringify({ jobId, clipUrl: clip.baseUrl, styleConfig, clipData: clip.source })
      });
      setExportedAt(prev => ({ ...prev, [clip.id]: Date.now() }));
    } catch (err) {
      setExportError(errorMessage(err, 'Export failed.'));
    } finally {
      setExportingClipId(current => (current === clip.id ? null : current));
    }
  };

  const openPublishModal = async () => {
    if (!activeClip) return;
    const youtube = activeClip.metadata.youtube_shorts;
    setPublishForm({
      title: activeClip.title,
      description: youtube?.description || '',
      hashtags: youtube?.hashtags?.map(h => `#${h.replace(/^#/, '')}`).join(' ') || '',
      platforms: [],
    });
    setSchedule('now');
    setCustomTime('');
    setPublishResult(null);
    setShowPublishModal(true);
    try {
      const connected = await apiFetch<Account[]>('/api/accounts');
      setAccounts(connected);
      // Preselect only platforms that can actually publish
      setPublishForm(prev => ({ ...prev, platforms: PLATFORMS.map(p => p.id).filter(id => connected.some(a => a.platform === id)) }));
    } catch {
      setAccounts([]);
    }
  };

  const closePublishModal = useCallback(() => setShowPublishModal(false), []);

  useEffect(() => {
    if (!showPublishModal) return;
    dialogRef.current?.querySelector<HTMLElement>('button, input, textarea, select')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePublishModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPublishModal, closePublishModal]);

  const handlePublish = async () => {
    if (!activeClip) return;
    const scheduledTime = scheduledTimeFor(schedule, customTime);
    if (!scheduledTime) {
      setPublishResult({ ok: false, message: 'Pick a date and time for the post.' });
      return;
    }
    setIsPublishing(true);
    setPublishResult(null);
    try {
      await apiFetch('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          // The clip's final render (re-exports replace the same file)
          clip_url: activeClip.url,
          platforms: publishForm.platforms,
          title: publishForm.title || activeClip.title,
          description: publishForm.description,
          hashtags: publishForm.hashtags,
          scheduled_time: scheduledTime
        })
      });
      setPublishResult({ ok: true, message: 'Post scheduled. Track it in the Publishing Queue.' });
    } catch (err) {
      setPublishResult({ ok: false, message: errorMessage(err, 'Failed to schedule the post.') });
    } finally {
      setIsPublishing(false);
    }
  };

  const downloadAll = async () => {
    for (const clip of clips) {
      await downloadFile(clip.url, fileNameFromUrl(clip.url));
    }
  };

  if (loadState !== 'ready') {
    const content = {
      loading: { title: 'Loading results...', body: '' },
      processing: { title: 'Still processing', body: 'This job is not finished yet.' },
      failed: { title: 'This job failed', body: loadError },
      error: { title: 'Could not load results', body: loadError },
    }[loadState];
    return (
      <div className="page-shell max-w-2xl mx-auto flex flex-col items-center text-center mt-16">
        {loadState === 'loading' ? <Loader className="w-10 h-10 text-[var(--color-accent)] animate-spin mb-6" /> : <AlertTriangle className="w-10 h-10 text-[var(--color-warn)] mb-6" />}
        <h2 className="page-title mb-3">{content.title}</h2>
        {content.body && <p className="text-[var(--color-muted)] mb-8" role="alert">{content.body}</p>}
        {loadState === 'processing' && <Link to={`/processing/${jobId}`} className="btn-primary">View progress</Link>}
        {(loadState === 'failed' || loadState === 'error') && <Link to="/" className="btn-primary">Back to dashboard</Link>}
      </div>
    );
  }

  const tabs = [
    { id: 'final_clip' as const, label: 'Final Output', show: true },
    { id: 'customizer' as const, label: 'Customizer', show: Boolean(activeClip?.baseUrl) },
    { id: 'metadata' as const, label: 'Social Media', show: Boolean(activeClip && Object.keys(activeClip.metadata).length) },
  ].filter(t => t.show);

  const playResY = PLAY_RES_Y[shape];
  // Words carry source-video times; the preview player starts at the clip's start
  const sourceTime = currentTime + (activeClip?.startTime ?? 0);
  const isExportingActive = exportingClipId !== null && exportingClipId === activeClip?.id;

  return (
    <div className="page-shell max-w-7xl mx-auto animate-fade-in-up">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6 panel p-6 md:p-8">
        <div>
          <h2 className="page-title mb-2 flex items-center gap-3">
            <CheckCircle className="w-7 h-7 text-[var(--color-ok)]" aria-hidden="true" />
            Your Viral Clips
          </h2>
          <p className="page-subtitle !mt-0">
            {clips.length === 1 ? 'Your video is ready.' : `We identified ${clips.length} highly engaging moments.`}
          </p>
        </div>
        <Link to="/" className="btn-primary">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" /> Convert Another Video
        </Link>
      </div>

      {warnings.length > 0 && (
        <div className="alert-warn mb-8 flex gap-3" role="status">
          <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <ul className="space-y-1">{warnings.map(w => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left: Active Clip Preview & Settings (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {activeClip ? (
            <div className="panel p-6 md:p-8 flex flex-col gap-6 relative">
              <div className="flex justify-center gap-3 mb-2 flex-wrap" role="tablist" aria-label="Clip views">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-5 py-2 rounded-md font-bold transition-colors text-sm ${activeTab === tab.id ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-canvas)] text-[var(--color-muted)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'final_clip' && (
                <div className="flex flex-col gap-6 items-center">
                  <p className="text-[var(--color-muted)] font-semibold text-center text-sm">
                    {exportedAt[activeClip.id] ? 'Your customized export with burned-in captions.' : 'The generated video with burned-in, synced captions.'}
                  </p>
                  <div className={`relative w-full mx-auto bg-black rounded-xl overflow-hidden border border-[var(--color-border)] ${ASPECT_CLASS[shape]}`}>
                    <video key={finalUrl} src={finalUrl} controls autoPlay className="w-full h-full object-contain" />
                  </div>
                  <div className="w-full max-w-[320px] flex flex-col gap-3">
                    <button type="button" onClick={() => downloadFile(finalUrl, fileNameFromUrl(activeClip.url))} className="btn-primary w-full py-3.5">
                      <Download className="w-5 h-5" aria-hidden="true" /> Download Video
                    </button>
                    <button type="button" onClick={openPublishModal} className="btn-secondary w-full py-3.5">
                      <Globe className="w-5 h-5" aria-hidden="true" /> Auto-Publish to Socials
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'customizer' && activeClip.baseUrl && (
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  {/* Preview with caption overlay (sized relative to the video, like the renderer) */}
                  <div
                    className={`relative w-full mx-auto bg-black rounded-xl overflow-hidden border border-[var(--color-border)] flex-shrink-0 ${shape === 'vertical' ? 'aspect-[9/16] max-w-[280px]' : shape === 'square' ? 'aspect-square max-w-[300px]' : 'aspect-video max-w-[420px]'}`}
                    style={{ containerType: 'size' }}
                  >
                    <video
                      ref={videoRef}
                      key={activeClip.baseUrl}
                      src={activeClip.baseUrl}
                      controls
                      autoPlay
                      onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                      className="w-full h-full object-contain"
                    />
                    <div
                      className="absolute w-full flex justify-center items-center pointer-events-none px-4 text-center"
                      style={{
                        bottom: `${(styleConfig.marginV / playResY) * 100}%`,
                        fontFamily: styleConfig.fontName,
                        fontSize: `${(styleConfig.fontSize / playResY) * 100}cqh`,
                        fontWeight: 900,
                        textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 10px rgba(0,0,0,0.8)'
                      }}
                      aria-hidden="true"
                    >
                      <div className="flex flex-wrap justify-center gap-[4px] leading-tight">
                        {activeClip.words.filter(w => w.start <= sourceTime + 1.0 && w.end >= sourceTime - 1.0).map((w, idx) => {
                          const isActive = sourceTime >= w.start && sourceTime <= w.end;
                          return (
                            <span
                              key={`${w.start}-${idx}`}
                              style={{
                                color: cssColor(isActive ? styleConfig.highlightColor : styleConfig.primaryColor),
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
                      <h3 className="font-display text-xl font-bold text-[var(--color-ink)] mb-4 flex items-center gap-2"><Sliders className="w-5 h-5" aria-hidden="true" /> Caption Customizer</h3>

                      <div className="space-y-4">
                        <div>
                          <label htmlFor="caption-theme" className="field-label flex items-center gap-2"><Type className="w-4 h-4" aria-hidden="true" /> Theme</label>
                          <select
                            id="caption-theme"
                            value={styleConfig.theme}
                            onChange={(e) => setStyleConfig({ ...defaultStyle(shape, e.target.value), marginV: styleConfig.marginV })}
                            className="field-input"
                          >
                            {Object.entries(THEMES).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="caption-color" className="field-label flex items-center gap-2"><Palette className="w-4 h-4" aria-hidden="true" /> Text Color</label>
                            <select
                              id="caption-color"
                              value={styleConfig.primaryColor}
                              onChange={(e) => setStyleConfig({ ...styleConfig, primaryColor: e.target.value })}
                              className="field-input"
                            >
                              {COLORS.map(c => <option key={c.ass} value={c.ass}>{c.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label htmlFor="caption-highlight" className="field-label flex items-center gap-2"><Palette className="w-4 h-4" aria-hidden="true" /> Highlight</label>
                            <select
                              id="caption-highlight"
                              value={styleConfig.highlightColor}
                              onChange={(e) => setStyleConfig({ ...styleConfig, highlightColor: e.target.value })}
                              className="field-input"
                            >
                              {COLORS.map(c => <option key={c.ass} value={c.ass}>{c.name}</option>)}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="caption-position" className="field-label flex items-center gap-2"><Move className="w-4 h-4" aria-hidden="true" /> Vertical Position</label>
                          <input
                            id="caption-position"
                            type="range"
                            min={Math.round(playResY * 0.03)} max={Math.round(playResY * 0.9)}
                            value={styleConfig.marginV}
                            onChange={(e) => setStyleConfig({ ...styleConfig, marginV: parseInt(e.target.value) })}
                            className="w-full accent-[var(--color-accent)]"
                          />
                          <div className="flex justify-between text-[10px] text-[var(--color-faint)] font-bold px-1 mt-1" aria-hidden="true">
                            <span>Bottom</span>
                            <span>Middle</span>
                            <span>Top</span>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="caption-size" className="field-label flex items-center gap-2"><Type className="w-4 h-4" aria-hidden="true" /> Font Size</label>
                          <input
                            id="caption-size"
                            type="range"
                            min="24" max="120"
                            value={styleConfig.fontSize}
                            onChange={(e) => setStyleConfig({ ...styleConfig, fontSize: parseInt(e.target.value) })}
                            className="w-full accent-[var(--color-accent)]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--color-border)] flex flex-col gap-3">
                      {exportedAt[activeClip.id] && !isExportingActive && (
                        <div className="bg-[rgba(61,154,106,0.12)] border border-[rgba(61,154,106,0.35)] p-4 rounded-[10px] text-[var(--color-ok)] font-bold text-center flex items-center justify-center gap-2" role="status">
                          <CheckCircle className="w-5 h-5" aria-hidden="true" /> Export saved as this clip's final video
                        </div>
                      )}
                      {exportError && <p className="text-sm text-[var(--color-danger)] font-medium" role="alert">{exportError}</p>}
                      <button
                        type="button"
                        onClick={handleExport}
                        disabled={isExportingActive}
                        className={`w-full py-3.5 font-bold rounded-[10px] transition-colors flex justify-center items-center gap-2 ${isExportingActive ? 'bg-[var(--color-canvas)] text-[var(--color-muted)] cursor-not-allowed border border-[var(--color-border)]' : 'btn-primary'}`}
                      >
                        {isExportingActive ? (
                          <><Loader className="w-5 h-5 animate-spin" aria-hidden="true" /> Rendering Subtitles...</>
                        ) : (
                          <><Play className="w-5 h-5 fill-current" aria-hidden="true" /> {exportedAt[activeClip.id] ? 'Export Again' : 'Burn Subtitles & Export'}</>
                        )}
                      </button>
                      {exportedAt[activeClip.id] && (
                        <button type="button" onClick={() => setActiveTab('final_clip')} className="btn-secondary w-full">
                          View, download or publish the export
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'metadata' && (
                <div className="space-y-6">
                  <h3 className="font-display text-xl font-bold text-[var(--color-ink)] mb-2">Social Media Pack</h3>
                  <p className="text-sm text-[var(--color-muted)] font-medium mb-6">AI generated ready-to-post content for your clip.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SOCIAL_CARDS.filter(card => activeClip.metadata[card.key]).map(card => {
                      const copy = activeClip.metadata[card.key];
                      return (
                        <div key={card.key} className="panel p-5 relative group">
                          <div className="absolute top-4 right-4 text-[var(--color-muted)] opacity-50 group-hover:opacity-100 transition-opacity" aria-hidden="true">{card.icon}</div>
                          <p className="text-[10px] uppercase tracking-widest text-[var(--color-faint)] font-bold mb-2">{card.label}</p>
                          {copy.title && <h4 className="font-bold text-[var(--color-ink)] mb-2 pr-8">{copy.title}</h4>}
                          {(copy.description || copy.post || copy.tweet) && <p className="text-sm text-[var(--color-muted)] mb-3 whitespace-pre-line">{copy.description || copy.post || copy.tweet}</p>}
                          {copy.hashtags && copy.hashtags.length > 0 && <p className="text-xs font-bold text-[var(--color-muted)]">{copy.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}</p>}
                          <CopyButton text={copyFromMetadata(copy)} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="panel p-20 text-center flex flex-col items-center justify-center h-full">
              <Play className="w-16 h-16 text-[var(--color-faint)] opacity-50 mb-4" aria-hidden="true" />
              <p className="text-[var(--color-muted)] font-bold">This job didn't produce any clips.</p>
            </div>
          )}
        </div>

        {/* Right: Clip List Sidebar (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <h3 className="font-display text-lg font-bold text-[var(--color-ink)] px-2">Generated Highlights ({clips.length})</h3>
          <div className="flex flex-col gap-4 max-h-[850px] overflow-y-auto pr-2 custom-scrollbar">
            {clips.map((clip) => {
              const isSelected = activeClip?.id === clip.id;
              return (
                <button
                  type="button"
                  key={clip.id}
                  onClick={() => selectClip(clip)}
                  aria-pressed={isSelected}
                  className={`text-left panel p-4 flex gap-4 transition-colors border-2
                    ${isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'}`}
                >
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-[10px] bg-[var(--color-canvas)] relative overflow-hidden flex-shrink-0 flex items-center justify-center border border-[var(--color-border)]">
                    {clip.thumbnail
                      ? <img src={clip.thumbnail} alt="" className="w-full h-full object-cover opacity-70" />
                      : <Film className="w-8 h-8 text-[var(--color-faint)]" aria-hidden="true" />}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className={`p-2 rounded-full ${isSelected ? 'bg-[var(--color-accent)] text-white' : 'bg-black/40 text-white'}`}>
                        <Play className="w-4 h-4 ml-0.5" fill="currentColor" aria-hidden="true" />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                    <div>
                      <h4 className="text-base font-bold truncate text-[var(--color-ink)]">{clip.title}</h4>
                      {clip.duration && <p className="text-xs text-[var(--color-faint)] font-semibold mt-1">Duration: {clip.duration}</p>}
                      {clip.reasoning && <p className="text-xs text-[var(--color-faint)] mt-1 line-clamp-2">{clip.reasoning}</p>}
                    </div>

                    {clip.score !== null && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider">Virality Score</span>
                        <span className="text-xs font-black text-[var(--color-accent)] bg-[var(--color-accent-soft)] px-2 py-0.5 rounded border border-[rgba(232,93,59,0.35)]">
                          {clip.score}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Transcript Section */}
      {transcript && (
        <div className="mt-12 panel p-6 md:p-8 animate-fade-in-up">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="font-display text-2xl font-bold text-[var(--color-ink)] flex items-center gap-3">
              <FileText className="w-6 h-6 text-[var(--color-muted)]" aria-hidden="true" />
              Full Video Transcript
            </h3>
            <CopyButton text={transcript} label="Copy Text" />
          </div>
          <div className="p-6 bg-[var(--color-canvas)] rounded-xl max-h-[500px] overflow-y-auto font-medium text-[var(--color-muted)] leading-loose text-base border border-[var(--color-border)]">
            {transcript}
          </div>
        </div>
      )}

      {clips.length > 1 && (
        <div className="mt-10 text-center pb-6">
          <button type="button" onClick={downloadAll} className="btn-secondary inline-flex items-center gap-3">
            <Download className="w-5 h-5" aria-hidden="true" /> Download All Clips
          </button>
        </div>
      )}

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closePublishModal}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-title"
            onClick={(e) => e.stopPropagation()}
            className="panel p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 id="publish-title" className="font-display text-2xl font-bold text-[var(--color-ink)]">Publish Video</h2>
              <button type="button" onClick={closePublishModal} className="text-[var(--color-muted)] hover:text-[var(--color-ink)]" aria-label="Close"><X className="w-6 h-6" /></button>
            </div>

            <div className="space-y-6">
              <fieldset>
                <legend className="field-label">Platforms</legend>
                <div className="flex flex-wrap gap-3">
                  {PLATFORMS.map(p => {
                    const connected = accounts.some(a => a.platform === p.id);
                    const selected = publishForm.platforms.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        aria-pressed={selected}
                        onClick={() => setPublishForm(prev => ({
                          ...prev,
                          platforms: selected ? prev.platforms.filter(x => x !== p.id) : [...prev.platforms, p.id]
                        }))}
                        className={`px-4 py-2 rounded-[10px] font-bold transition-colors border text-left ${selected ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-ink)]' : 'bg-[var(--color-canvas)] border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)]'}`}
                      >
                        {p.name}
                        {!connected && <span className="block text-[10px] font-semibold text-[var(--color-warn)]">Not connected</span>}
                      </button>
                    );
                  })}
                </div>
                {publishForm.platforms.some(id => !accounts.some(a => a.platform === id)) && (
                  <p className="text-xs text-[var(--color-warn)] mt-2">
                    Posts to platforms that aren't connected will fail. <Link to="/accounts" className="underline">Connect accounts</Link>
                  </p>
                )}
              </fieldset>

              <div>
                <label htmlFor="publish-title-input" className="field-label">Title</label>
                <input
                  id="publish-title-input"
                  type="text"
                  value={publishForm.title}
                  onChange={e => setPublishForm({ ...publishForm, title: e.target.value })}
                  className="field-input"
                />
              </div>

              <div>
                <label htmlFor="publish-description" className="field-label">Description</label>
                <textarea
                  id="publish-description"
                  rows={3}
                  value={publishForm.description}
                  onChange={e => setPublishForm({ ...publishForm, description: e.target.value })}
                  className="field-input resize-none"
                />
              </div>

              <div>
                <label htmlFor="publish-hashtags" className="field-label">Hashtags</label>
                <input
                  id="publish-hashtags"
                  type="text"
                  value={publishForm.hashtags}
                  onChange={e => setPublishForm({ ...publishForm, hashtags: e.target.value })}
                  className="field-input text-[var(--color-accent)]"
                />
              </div>

              <div>
                <label htmlFor="publish-schedule" className="field-label">Schedule</label>
                <select
                  id="publish-schedule"
                  value={schedule}
                  onChange={e => setSchedule(e.target.value as ScheduleChoice)}
                  className="field-input"
                >
                  <option value="now">Post Immediately</option>
                  <option value="hour">In 1 Hour</option>
                  <option value="tomorrow">Tomorrow (same time)</option>
                  <option value="custom">Pick a date and time</option>
                </select>
                {schedule === 'custom' && (
                  <input
                    type="datetime-local"
                    aria-label="Publish date and time"
                    value={customTime}
                    onChange={e => setCustomTime(e.target.value)}
                    className="field-input mt-3"
                  />
                )}
              </div>

              {publishResult && (
                <p className={`text-sm font-medium ${publishResult.ok ? 'text-[var(--color-ok)]' : 'text-[var(--color-danger)]'}`} role="alert">
                  {publishResult.message} {publishResult.ok && <Link to="/queue" className="underline">Open queue</Link>}
                </p>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-[var(--color-border)]">
                <button type="button" onClick={closePublishModal} className="btn-secondary">
                  {publishResult?.ok ? 'Close' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing || publishForm.platforms.length === 0 || publishResult?.ok}
                  className="btn-primary"
                >
                  {isPublishing ? 'Scheduling...' : `Queue Post${publishForm.platforms.length > 1 ? 's' : ''}`}
                </button>
              </div>
              {publishForm.platforms.length > 0 && (
                <p className="text-xs text-[var(--color-faint)] text-right">Publishing to {publishForm.platforms.map(platformName).join(', ')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Results;
