import React from 'react';
import { Settings, Mic, Cpu, Film, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const HowItWorks = () => {
  const steps = [
    {
      title: "1. Video Acquisition",
      icon: <Settings className="w-8 h-8 text-yellow-400" />,
      desc: "Submit a YouTube link or upload a local file. The Node.js backend handles the file securely and extracts the high-quality audio track using FFmpeg."
    },
    {
      title: "2. Offline Transcription",
      icon: <Mic className="w-8 h-8 text-yellow-400" />,
      desc: "OpenAI Whisper runs 100% locally to transcribe the audio into text with extreme accuracy, generating word-level timestamps."
    },
    {
      title: "3. NLP Highlight Detection",
      icon: <Cpu className="w-8 h-8 text-yellow-400" />,
      desc: "Our custom NLP engine uses spaCy and NLTK to score segments based on keyword density (TF-IDF), sentiment, and Named Entity Recognition to find the 'viral' moments."
    },
    {
      title: "4. Automated Video Editing",
      icon: <Film className="w-8 h-8 text-yellow-400" />,
      desc: "MoviePy crops the video into a 9:16 vertical format, and FFmpeg burns the generated SRT subtitles directly into the final MP4."
    }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in-up mt-16 px-4">
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 drop-shadow-xl">How It Works</h1>
        <p className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto font-medium">
          A fully open-source, locally run AI pipeline that transforms long-form content into viral shorts with zero paid API dependencies.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {steps.map((step, idx) => (
          <div key={idx} className="glass-panel-dark p-8 rounded-3xl border-2 border-white/10 hover:border-white/30 transition-all hover:-translate-y-2">
            <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
              {step.icon}
            </div>
            <h3 className="text-2xl font-black text-white mb-4">{step.title}</h3>
            <p className="text-lg text-white/70 font-medium leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>

      <div className="text-center pb-20">
        <Link to="/" className="inline-flex items-center gap-3 px-8 py-4 bg-white hover:bg-gray-200 text-black rounded-2xl text-xl font-black shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:scale-105 transition-all">
          <CheckCircle className="w-6 h-6" /> Try it Now
        </Link>
      </div>
    </div>
  );
};

export default HowItWorks;
