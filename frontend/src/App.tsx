import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import AuthGate from './components/AuthGate';
import Navbar from './components/Navbar';
import BackgroundEffects from './components/BackgroundEffects';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Processing from './pages/Processing';
import Results from './pages/Results';
import HowItWorks from './pages/HowItWorks';
import Projects from './pages/Projects';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Accounts from './pages/Accounts';
import Queue from './pages/Queue';
import StoryToVideo from './pages/StoryToVideo';
import AutoEdit from './pages/AutoEdit';
import './index.css';

function PageErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}

const NotFound = () => (
  <div className="page-shell items-center justify-center text-center py-28">
    <h1 className="page-title mb-2">Page not found</h1>
    <p className="page-subtitle mb-8">That route doesn’t exist in this workspace.</p>
    <Link to="/" className="btn-primary">Back to dashboard</Link>
  </div>
);

function App() {
  return (
    <AuthGate>
      <Router>
        <div className="min-h-screen text-[var(--color-ink)] font-sans overflow-hidden relative flex">
          <BackgroundEffects />
          <Sidebar />
          <div className="flex-1 flex flex-col md:ml-60 w-full md:w-[calc(100%-15rem)] relative z-10 min-h-screen">
            <Navbar />
            <main className="flex-1 relative">
              <PageErrorBoundary>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/how-it-works" element={<HowItWorks />} />
                  <Route path="/processing/:jobId" element={<Processing />} />
                  <Route path="/results/:jobId" element={<Results />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/queue" element={<Queue />} />
                  <Route path="/story-to-video" element={<StoryToVideo />} />
                  <Route path="/auto-edit" element={<AutoEdit />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </PageErrorBoundary>
            </main>
          </div>
        </div>
      </Router>
    </AuthGate>
  );
}

export default App;
