import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import BackgroundEffects from './components/BackgroundEffects';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Processing from './pages/Processing';
import Results from './pages/Results';
import HowItWorks from './pages/HowItWorks';
import './index.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen text-white font-sans overflow-hidden relative selection:bg-[#66fcf1] selection:text-black flex">
        <BackgroundEffects />
        
        {/* Sidebar for Desktop */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col md:ml-64 w-full relative z-10 min-h-screen">
          <Navbar />
          <main className="flex-1 relative pb-10">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/processing/:jobId" element={<Processing />} />
              <Route path="/results/:jobId" element={<Results />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
