import { Download, Mic, Cpu, Film, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Panel } from '../components/ui';

const HowItWorks = () => {
  const steps = [
    {
      title: 'Acquire the video',
      icon: Download,
      desc: 'Paste a YouTube or web link, or upload a file. Links download via yt-dlp (up to 1080p); audio is extracted with FFmpeg.',
    },
    {
      title: 'Transcribe speech',
      icon: Mic,
      desc: 'Audio is chunked and transcribed in parallel with Whisper large-v3 on Groq, including word-level timestamps.',
    },
    {
      title: 'Find viral moments',
      icon: Cpu,
      desc: 'Gemini reads the transcript, picks self-contained highlights, scores virality, and drafts titles and hashtags.',
    },
    {
      title: 'Edit & caption',
      icon: Film,
      desc: 'FFmpeg cuts each highlight, crops to 9:16 or fits 16:9, and burns animated word-highlight captions you can restyle.',
    },
    {
      title: 'Publish',
      icon: Send,
      desc: 'Connect YouTube, TikTok, Instagram or X. Post now or schedule. Failed uploads retry; the same clip never posts twice to one platform.',
    },
  ];

  return (
    <div className="page-shell max-w-4xl mx-auto animate-fade-in-up">
      <div className="mb-10 max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)] mb-3">Pipeline</p>
        <h1 className="page-title mb-3">How ClipGenius works</h1>
        <p className="page-subtitle text-base">
          A self-hosted flow that turns long-form video into short, captioned clips — Groq and Gemini handle the AI steps.
        </p>
      </div>

      <ol className="space-y-4 mb-12">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.title}>
              <Panel className="p-5 sm:p-6 flex gap-4 sm:gap-5">
                <div className="shrink-0 w-11 h-11 rounded-lg bg-[var(--color-accent-soft)] flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[var(--color-accent)]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[var(--color-faint)] mb-1">Step {i + 1}</p>
                  <h2 className="font-display text-lg font-bold text-[var(--color-ink)] mb-1.5">{step.title}</h2>
                  <p className="text-sm text-[var(--color-muted)] leading-relaxed">{step.desc}</p>
                </div>
              </Panel>
            </li>
          );
        })}
      </ol>

      <div className="flex justify-start pb-8">
        <Link to="/" className="btn-primary px-8 py-3.5">Start a clip job</Link>
      </div>
    </div>
  );
};

export default HowItWorks;
