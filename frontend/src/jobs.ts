import type { JobSummary, JobType } from './types';

// Finished jobs open their results; running or failed ones show progress or the failure reason
export const jobLink = (job: JobSummary) => (job.status === 'Completed' ? `/results/${job.id}` : `/processing/${job.id}`);

export const statusBadgeClass = (status: JobSummary['status']) =>
  status === 'Completed' ? 'border-[rgba(61,154,106,0.35)] text-[#7dcaa3] bg-[rgba(61,154,106,0.12)]'
    : status === 'Processing' ? 'border-[rgba(232,93,59,0.35)] text-[var(--color-accent)] bg-[var(--color-accent-soft)]'
    : 'border-[rgba(212,83,74,0.35)] text-[#f0a8a2] bg-[rgba(212,83,74,0.12)]';

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  clips: 'Viral clips',
  auto_edit: 'Auto edit',
  story_to_video: 'Story video',
};
