import { useState, useEffect } from 'react';
import { Folder, Play, Clock, CheckCircle, XCircle, Search, Film, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, errorMessage, mediaUrl } from '../api';
import { formatDuration, timeAgo } from '../utils';
import { jobLink, JOB_TYPE_LABELS } from '../jobs';
import type { JobSummary } from '../types';

type StatusFilter = 'all' | JobSummary['status'];

const Projects = () => {
  const [projects, setProjects] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    apiFetch<JobSummary[]>('/api/jobs')
      .then(setProjects)
      .catch(err => setError(errorMessage(err, 'Could not load your projects.')))
      .finally(() => setLoading(false));
  }, []);

  const search = query.trim().toLowerCase();
  const visible = projects.filter(p =>
    (statusFilter === 'all' || p.status === statusFilter) &&
    (!search || p.title.toLowerCase().includes(search) || p.id.toLowerCase().includes(search))
  );

  return (
    <div className="w-full flex flex-col p-8 animate-fade-in-up">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Folder className="w-8 h-8 text-white" aria-hidden="true" />
            My Projects
          </h1>
          <p className="text-gray-400 font-medium">Manage and review all your video processing jobs.</p>
        </div>

        <Link to="/" className="px-6 py-3 bg-white hover:bg-gray-200 text-black font-bold rounded-xl transition-all shadow-lg">
          New Project
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-white transition-colors" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search projects"
            placeholder="Search projects..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-white/50 transition-all text-white placeholder:text-gray-600"
          />
        </div>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-white/50"
        >
          <option value="all">All statuses</option>
          <option value="Completed">Completed</option>
          <option value="Processing">Processing</option>
          <option value="Failed">Failed</option>
        </select>
      </div>

      {/* Project Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20" role="status" aria-label="Loading projects">
          <div className="w-12 h-12 border-4 border-white/20 border-t-[#66fcf1] rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 bg-black/40 rounded-2xl border border-red-500/20" role="alert">
          <AlertTriangle className="w-12 h-12 text-red-400 mb-4" aria-hidden="true" />
          <p className="text-red-400 font-medium">{error}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-black/40 rounded-2xl border border-white/10">
          <Folder className="w-16 h-16 text-gray-500 mb-4 opacity-50" aria-hidden="true" />
          <h2 className="text-xl font-bold text-white mb-2">No projects found</h2>
          <p className="text-gray-400">{projects.length === 0 ? 'Start by submitting a new video on the dashboard.' : 'Try a different search or filter.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((project, i) => {
            const thumbnail = mediaUrl(project.thumbnail);
            const duration = formatDuration(project.sourceDuration);
            return (
              <div
                key={project.id}
                className="glass-panel-dark rounded-2xl overflow-hidden border border-white/10 hover:border-white/30 transition-all group flex flex-col hover:-translate-y-1 hover:shadow-xl"
                style={{ animationDelay: `${i * 0.1}s`, animationFillMode: 'both' }}
              >
                {/* Thumbnail Area */}
                <div className="h-40 relative overflow-hidden bg-black/50 border-b border-white/10 flex items-center justify-center">
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt=""
                      className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                  ) : (
                    <Film className="w-10 h-10 text-gray-700" aria-hidden="true" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>

                  <div className="absolute top-3 right-3 flex gap-2">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-lg
                      ${project.status === 'Completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        project.status === 'Processing' ? 'bg-blue-500/20 text-white border border-blue-500/30 animate-pulse' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'}`}
                    >
                      {project.status === 'Completed' && <CheckCircle className="w-3 h-3 inline mr-1" aria-hidden="true" />}
                      {project.status === 'Processing' && <Clock className="w-3 h-3 inline mr-1" aria-hidden="true" />}
                      {project.status === 'Failed' && <XCircle className="w-3 h-3 inline mr-1" aria-hidden="true" />}
                      {project.status}
                    </span>
                  </div>

                  {duration && (
                    <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-white border border-white/10" title="Source video length">
                      {duration}
                    </div>
                  )}

                  <Link to={jobLink(project)} aria-label={`Open ${project.title}`} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-black/30 backdrop-blur-[2px]">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Play className="w-5 h-5 text-black ml-1" fill="currentColor" aria-hidden="true" />
                    </div>
                  </Link>
                </div>

                {/* Details Area */}
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-white line-clamp-1 mb-2" title={project.title}>{project.title}</h3>

                  <p className="text-xs text-gray-500 font-medium mb-4 flex items-center gap-2">
                    <span>{JOB_TYPE_LABELS[project.type] ?? project.type}</span>
                    <span aria-hidden="true">•</span>
                    <span>{timeAgo(project.createdAt)}</span>
                  </p>

                  {project.status === 'Failed' && project.error && (
                    <p className="text-xs text-red-400/90 mb-4 line-clamp-3" title={project.error}>{project.error}</p>
                  )}

                  <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">
                        {project.type === 'clips' ? 'Extracted Clips' : 'Videos'}
                      </span>
                      <span className="text-lg font-bold text-white">{project.clips}</span>
                    </div>
                    <Link to={jobLink(project)} className="text-sm font-bold text-white hover:underline">
                      {project.status === 'Completed' ? 'View Clips' : project.status === 'Processing' ? 'View Progress' : 'View Details'} &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Projects;
