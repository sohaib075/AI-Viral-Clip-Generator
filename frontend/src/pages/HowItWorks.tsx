import { Download, Mic, Cpu, Film, Send, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const HowItWorks = () => {
  const steps = [
    {
      title: "1. Video Acquisition",
      icon: <Download className="w-8 h-8 text-yellow-400" aria-hidden="true" />,
      desc: "Paste a YouTube or web link, or upload a file. Links are downloaded with yt-dlp (up to 1080p) and the audio track is extracted with FFmpeg."
    },
    {
      title: "2. Transcription",
      icon: <Mic className="w-8 h-8 text-yellow-400" aria-hidden="true" />,
      desc: "The audio is split into 5-minute chunks and transcribed in parallel by Whisper large-v3 on the Groq API, with word-level timestamps."
    },
    {
      title: "3. AI Highlight Detection",
      icon: <Cpu className="w-8 h-8 text-yellow-400" aria-hidden="true" />,
      desc: "Google Gemini reads the whole transcript, picks self-contained highlights with a virality score, and writes titles, descriptions and hashtags for each platform."
    },
    {
      title: "4. Automated Editing",
      icon: <Film className="w-8 h-8 text-yellow-400" aria-hidden="true" />,
      desc: "FFmpeg cuts each highlight, crops it to 9:16 or fits it to 16:9, and burns in animated captions that highlight each spoken word. You can restyle captions and export again."
    },
    {
      title: "5. Publishing",
      icon: <Send className="w-8 h-8 text-yellow-400" aria-hidden="true" />,
      desc: "Connect YouTube, TikTok, Instagram or X, then post immediately or on a schedule. The queue retries temporary failures and never uploads the same video twice to a platform."
    }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in-up mt-16 px-4">
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 drop-shadow-xl">How It Works</h1>
        <p className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto font-medium">
          A self-hosted pipeline that turns long-form video into short, captioned clips, using the Groq and Gemini APIs for the AI steps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {steps.map((step) => (
          <div key={step.title} className="glass-panel-dark p-8 rounded-3xl border-2 border-white/10 hover:border-white/30 transition-all hover:-translate-y-2">
            <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
              {step.icon}
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">{step.title}</h2>
            <p className="text-lg text-white/70 font-medium leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>

      <div className="text-center pb-20">
        <Link to="/" className="inline-flex items-center gap-3 px-8 py-4 bg-white hover:bg-gray-200 text-black rounded-2xl text-xl font-bold shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:scale-105 transition-all">
          <CheckCircle className="w-6 h-6" aria-hidden="true" /> Try it Now
        </Link>
      </div>
    </div>
  );
};

export default HowItWorks;
