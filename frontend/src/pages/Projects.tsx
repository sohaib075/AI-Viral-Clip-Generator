import React, { useState, useEffect } from 'react';
import { Folder, MoreVertical, Play, Clock, CheckCircle, XCircle, Search, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Projects = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/jobs`)
      .then(res => res.json())
      .then(data => {
        setProjects(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch projects:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="w-full flex flex-col p-8 animate-fade-in-up">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
            <Folder className="w-8 h-8 text-[#66fcf1]" />
            My Projects
          </h1>
          <p className="text-gray-400 font-medium">Manage and review all your video processing jobs.</p>
        </div>
        
        <Link to="/" className="px-6 py-3 bg-[#66fcf1] hover:bg-[#52c9c1] text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(102,252,241,0.4)] hover:shadow-[0_0_30px_rgba(102,252,241,0.6)]">
          New Project
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[#66fcf1] transition-colors" />
          <input 
            type="text" 
            placeholder="Search projects..." 
            className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-[#66fcf1]/50 focus:ring-1 focus:ring-[#66fcf1]/50 transition-all text-white placeholder:text-gray-600"
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-black/40 border border-white/10 hover:border-white/30 rounded-xl text-white font-semibold transition-colors">
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      {/* Project Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-12 h-12 border-4 border-white/20 border-t-[#66fcf1] rounded-full animate-spin"></div>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-black/40 rounded-2xl border border-white/10">
          <Folder className="w-16 h-16 text-gray-500 mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-white mb-2">No projects found</h2>
          <p className="text-gray-400">Start by submitting a new video on the dashboard.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, i) => (
            <div 
              key={project.id} 
              className="glass-panel-dark rounded-2xl overflow-hidden border border-white/10 hover:border-white/30 transition-all group flex flex-col hover:-translate-y-1 hover:shadow-xl"
              style={{ animationDelay: `${i * 0.1}s`, animationFillMode: 'both' }}
            >
              {/* Thumbnail Area */}
              <div className="h-40 relative overflow-hidden bg-black/50 border-b border-white/10">
                <img 
                  src={project.thumbnail.startsWith('http') ? project.thumbnail : `${API_URL}${project.thumbnail}`} 
                  alt={project.title} 
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                
                <div className="absolute top-3 right-3 flex gap-2">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-lg
                    ${project.status === 'Completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                      project.status === 'Processing' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse' : 
                      'bg-red-500/20 text-red-400 border border-red-500/30'}`}
                  >
                    {project.status === 'Completed' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                    {project.status === 'Processing' && <Clock className="w-3 h-3 inline mr-1" />}
                    {project.status === 'Failed' && <XCircle className="w-3 h-3 inline mr-1" />}
                    {project.status}
                  </span>
                </div>
                
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-white border border-white/10">
                  {project.duration}
                </div>
                
                {project.status === 'Completed' && (
                  <Link to={`/results/${project.id}`} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-[2px]">
                    <div className="w-12 h-12 bg-[#66fcf1] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(102,252,241,0.5)] transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="w-5 h-5 text-black ml-1" fill="currentColor" />
                    </div>
                  </Link>
                )}
              </div>

              {/* Details Area */}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-white line-clamp-1 group-hover:text-[#66fcf1] transition-colors">{project.title}</h3>
                  <button className="text-gray-500 hover:text-white transition-colors p-1"><MoreVertical className="w-4 h-4" /></button>
                </div>
                
                <p className="text-xs text-gray-500 font-medium mb-4 flex items-center gap-2">
                  <span className="font-mono text-gray-400">{project.id}</span>
                  <span>•</span>
                  <span>{project.time}</span>
                </p>
                
                <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Extracted Clips</span>
                    <span className="text-lg font-black text-white">{project.clips}</span>
                  </div>
                  {project.status === 'Completed' && (
                    <Link to={`/results/${project.id}`} className="text-sm font-bold text-[#66fcf1] hover:text-white transition-colors">
                      View Clips &rarr;
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Pagination */}
      <div className="mt-10 flex justify-center">
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-lg bg-black/40 border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50" disabled>Prev</button>
          <button className="px-4 py-2 rounded-lg bg-[#66fcf1]/20 border border-[#66fcf1]/50 text-[#66fcf1] font-bold">1</button>
          <button className="px-4 py-2 rounded-lg bg-black/40 border border-white/10 text-gray-400 hover:text-white hover:bg-white/5">2</button>
          <button className="px-4 py-2 rounded-lg bg-black/40 border border-white/10 text-gray-400 hover:text-white hover:bg-white/5">3</button>
          <button className="px-4 py-2 rounded-lg bg-black/40 border border-white/10 text-gray-400 hover:text-white hover:bg-white/5">Next</button>
        </div>
      </div>
    </div>
  );
};

export default Projects;
