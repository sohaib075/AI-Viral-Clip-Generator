import { useState, useEffect } from 'react';
import { Folder, Play, Clock, CheckCircle, XCircle, Search, Film, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, errorMessage, mediaUrl } from '../api';
import { formatDuration, timeAgo } from '../utils';
import { jobLink, JOB_TYPE_LABELS, statusBadgeClass } from '../jobs';
import { PageHeader, Panel } from '../components/ui';
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
    <div className="page-shell animate-fade-in-up max-w-6xl mx-auto">
      <PageHeader
        title="My Projects"
        subtitle="Manage and review all your video processing jobs."
        action={
          <Link to="/" className="btn-primary">
            New project
          </Link>
        }
      />

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-faint)]" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search projects"
            placeholder="Search projects..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="field-input pl-10"
          />
        </div>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="field-input md:w-48"
        >
          <option value="all">All statuses</option>
          <option value="Completed">Completed</option>
          <option value="Processing">Processing</option>
          <option value="Failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20" role="status" aria-label="Loading projects">
          <div className="w-10 h-10 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="alert-error flex flex-col items-center justify-center py-16 text-center" role="alert">
          <AlertTriangle className="w-10 h-10 mb-3" aria-hidden="true" />
          <p className="font-medium">{error}</p>
        </div>
      ) : visible.length === 0 ? (
        <Panel className="flex flex-col items-center justify-center py-20 text-center">
          <Folder className="w-12 h-12 text-[var(--color-faint)] mb-4 opacity-60" aria-hidden="true" />
          <h2 className="font-display text-xl font-bold text-[var(--color-ink)] mb-2">No projects found</h2>
          <p className="text-[var(--color-muted)] text-sm">{projects.length === 0 ? 'Start by submitting a new video on the dashboard.' : 'Try a different search or filter.'}</p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((project) => {
            const thumbnail = mediaUrl(project.thumbnail);
            const duration = formatDuration(project.sourceDuration);
            return (
              <Panel key={project.id} className="overflow-hidden flex flex-col">
                <div className="h-40 relative overflow-hidden bg-[var(--color-canvas)] border-b border-[var(--color-border)] flex items-center justify-center group">
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt=""
                      className="w-full h-full object-cover opacity-80"
                    />
                  ) : (
                    <Film className="w-10 h-10 text-[var(--color-faint)]" aria-hidden="true" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

                  <div className="absolute top-3 right-3">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusBadgeClass(project.status)}`}>
                      {project.status === 'Completed' && <CheckCircle className="w-3 h-3 inline mr-1" aria-hidden="true" />}
                      {project.status === 'Processing' && <Clock className="w-3 h-3 inline mr-1" aria-hidden="true" />}
                      {project.status === 'Failed' && <XCircle className="w-3 h-3 inline mr-1" aria-hidden="true" />}
                      {project.status}
                    </span>
                  </div>

                  {duration && (
                    <div className="absolute bottom-3 right-3 bg-black/60 px-2 py-1 rounded text-xs font-bold text-white border border-white/10" title="Source video length">
                      {duration}
                    </div>
                  )}

                  <Link to={jobLink(project)} aria-label={`Open ${project.title}`} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-black/25">
                    <div className="w-11 h-11 bg-[var(--color-accent)] rounded-full flex items-center justify-center">
                      <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" aria-hidden="true" />
                    </div>
                  </Link>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-display text-base font-bold text-[var(--color-ink)] line-clamp-1 mb-2" title={project.title}>{project.title}</h3>

                  <p className="text-xs text-[var(--color-faint)] font-medium mb-4 flex items-center gap-2">
                    <span>{JOB_TYPE_LABELS[project.type] ?? project.type}</span>
                    <span aria-hidden="true">•</span>
                    <span>{timeAgo(project.createdAt)}</span>
                  </p>

                  {project.status === 'Failed' && project.error && (
                    <p className="text-xs text-[var(--color-danger)] mb-4 line-clamp-3" title={project.error}>{project.error}</p>
                  )}

                  <div className="mt-auto pt-4 border-t border-[var(--color-border)] flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-faint)] font-bold mb-1">
                        {project.type === 'clips' ? 'Extracted Clips' : 'Videos'}
                      </span>
                      <span className="text-lg font-bold text-[var(--color-ink)]">{project.clips}</span>
                    </div>
                    <Link to={jobLink(project)} className="text-sm font-semibold text-[var(--color-accent)] hover:underline">
                      {project.status === 'Completed' ? 'View Clips' : project.status === 'Processing' ? 'View Progress' : 'View Details'} &rarr;
                    </Link>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Projects;
