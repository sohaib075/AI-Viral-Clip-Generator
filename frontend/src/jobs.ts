import type { JobSummary, JobType } from './types';

// Finished jobs open their results; running or failed ones show progress or the failure reason
export const jobLink = (job: JobSummary) => (job.status === 'Completed' ? `/results/${job.id}` : `/processing/${job.id}`);

export const statusBadgeClass = (status: JobSummary['status']) =>
  status === 'Completed' ? 'border-green-500/30 text-green-400 bg-green-500/10'
    : status === 'Processing' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10'
    : 'border-red-500/30 text-red-400 bg-red-500/10';

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  clips: 'Viral clips',
  auto_edit: 'Auto edit',
  story_to_video: 'Story video',
};
