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

// The Clipboard API only exists on secure origins (https or localhost); fall back to a hidden textarea
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the fallback
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

// Browsers ignore <a download> for files on another origin (the API runs on its own port), so fetch the file first
export async function downloadFile(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

export const fileNameFromUrl = (url: string, fallback = 'video.mp4') => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || fallback);
  } catch {
    return fallback;
  }
};
