export type JobType = 'clips' | 'auto_edit' | 'story_to_video';

export interface JobSummary {
  id: string;
  title: string;
  type: JobType;
  status: 'Processing' | 'Completed' | 'Failed';
  clips: number;
  thumbnail: string | null;
  createdAt: number;
  sourceDuration: number | null;
  error: string | null;
  warnings: string[];
}

export interface WordTiming {
  start: number;
  end: number;
  word: string;
}

export interface PlatformCopy {
  title?: string;
  description?: string;
  hashtags?: string[];
  post?: string;
  tweet?: string;
}

export interface ClipData {
  title: string;
  video_url: string;
  base_url?: string | null;
  thumbnail_url?: string | null;
  start_time?: number;
  end_time?: number;
  score?: number;
  reasoning?: string;
  segments?: { start: number; end: number; text: string }[];
  words?: WordTiming[];
  emphasized_words?: string[];
  metadata?: Record<string, PlatformCopy>;
  layout?: string;
}

export interface JobStatusResponse {
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  title?: string;
  clips?: ClipData[];
  transcript?: string;
  warnings?: string[];
}

export interface Account {
  id: string;
  platform: string;
  account_name: string;
  status: string;
  created_at: string;
}

export type PlatformResult = 'uploaded' | { error?: string; retryable?: boolean; retryRequested?: boolean };

export interface Post {
  id: string;
  clip_url: string;
  platforms: string;
  title: string | null;
  description: string | null;
  hashtags: string | null;
  scheduled_time: string;
  status: 'pending' | 'processing' | 'uploaded' | 'failed';
  retry_count: number;
  error_message: string | null;
  platform_results: string | null;
  created_at: string;
}

export interface Analytics {
  jobs: { total: number; completed: number; failed: number; processing: number };
  jobsByType: Partial<Record<JobType, number>>;
  totalClips: number;
  avgViralityScore: number | null;
  hoursProcessed: number | null;
  posts: { total: number; uploaded: number; failed: number; scheduled: number };
  platforms: Record<string, { uploaded: number; failed: number }>;
}

export interface Session {
  tokenRequired: boolean;
  authenticated: boolean;
}

// Platforms the backend can publish to
export const PLATFORMS = [
  { id: 'youtube', name: 'YouTube Shorts' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram Reels' },
  { id: 'x', name: 'X (Twitter)' },
] as const;

export const platformName = (id: string) => PLATFORMS.find(p => p.id === id)?.name ?? id;
