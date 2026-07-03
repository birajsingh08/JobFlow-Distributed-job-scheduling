import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy HH:mm');
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    QUEUED: 'badge-queued',
    SCHEDULED: 'badge-scheduled',
    CLAIMED: 'badge-running',
    RUNNING: 'badge-running',
    COMPLETED: 'badge-completed',
    FAILED: 'badge-failed',
    RETRYING: 'badge-retrying',
    DEAD: 'badge-dead',
    CANCELLED: 'badge-cancelled',
  };
  return map[status] ?? 'badge-queued';
}

export function getWorkerStatusColor(status: string): string {
  const map: Record<string, string> = {
    ONLINE: 'text-emerald-400',
    IDLE: 'text-blue-400',
    BUSY: 'text-amber-400',
    DRAINING: 'text-orange-400',
    OFFLINE: 'text-slate-500',
  };
  return map[status] ?? 'text-slate-500';
}

export function truncate(str: string, maxLength = 50): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}
