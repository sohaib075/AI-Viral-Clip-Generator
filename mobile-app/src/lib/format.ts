export const timeAgo = (timestamp: number) => {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(timestamp).toLocaleDateString();
};

export const formatDuration = (seconds: number | null | undefined) => {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

// SQLite stores UTC as "YYYY-MM-DD HH:MM:SS"
export const parseUtc = (value: string) => new Date(`${value.replace(' ', 'T')}Z`);

export const parseJson = <T,>(value: string | null | undefined, fallback: T): T => {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

// Finished jobs open their results; running or failed ones show progress or the failure reason
export const jobRoute = (job: { id: string; status: string }) =>
  job.status === 'Completed'
    ? ({ pathname: '/results', params: { jobId: job.id } } as const)
    : ({ pathname: '/processing/[jobId]', params: { jobId: job.id } } as const);

export const STATUS_COLORS: Record<string, { background: string; border: string; text: string }> = {
  Completed: { background: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', text: '#4ade80' },
  Processing: { background: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#60a5fa' },
  Failed: { background: 'rgba(248, 113, 113, 0.1)', border: 'rgba(248, 113, 113, 0.3)', text: '#f87171' },
};
