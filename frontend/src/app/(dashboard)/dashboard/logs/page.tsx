'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollText, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { useDashboardStore } from '@/store';

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  info: <Info className="w-3.5 h-3.5 text-blue-400" />,
  warn: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  error: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
  debug: <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />,
};

const LEVEL_CLASSES: Record<string, string> = {
  info: 'text-blue-300',
  warn: 'text-amber-300',
  error: 'text-red-300',
  debug: 'text-slate-400',
};

export default function LogsPage() {
  const { selectedProjectId } = useDashboardStore();
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');

  const { data: orgs } = useQuery({ queryKey: ['organizations'], queryFn: () => api.organizations.list() });
  const firstProject = ((orgs as unknown as any[]) ?? [])[0]?.projects?.[0];
  const projectId = selectedProjectId ?? firstProject?.id;

  const { data: queues } = useQuery({
    queryKey: ['queues', projectId],
    queryFn: () => api.queues.list(projectId!),
    enabled: !!projectId,
  });
  const queueList = (queues as unknown as any[]) ?? [];
  const targetQueue = selectedQueueId || queueList[0]?.id;

  const { data: jobs } = useQuery({
    queryKey: ['jobs', targetQueue],
    queryFn: () => api.jobs.list(targetQueue!, { limit: 50 }),
    enabled: !!targetQueue,
  });
  const jobList = ((jobs as any)?.jobs) ?? [];
  const targetJob = selectedJobId || jobList[0]?.id;

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['job-logs', targetJob],
    queryFn: () => api.jobs.logs(targetQueue!, targetJob!, { limit: 100 }),
    enabled: !!targetJob && !!targetQueue,
    refetchInterval: 5000,
  });
  const logs = (logsData as any)?.logs ?? [];

  return (
    <div className="flex flex-col">
      <Header title="Logs" subtitle="Real-time job execution logs" />

      <div className="p-6 space-y-5">
        <div className="flex gap-3">
          <select
            className="h-9 rounded-lg border border-input bg-background/50 px-3 text-sm"
            value={selectedQueueId}
            onChange={(e) => { setSelectedQueueId(e.target.value); setSelectedJobId(''); }}
          >
            {queueList.map((q: any) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>

          <select
            className="h-9 rounded-lg border border-input bg-background/50 px-3 text-sm flex-1 max-w-xs"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
          >
            {jobList.map((j: any) => (
              <option key={j.id} value={j.id}>{j.name} ({j.status}) — {j.id.slice(0, 8)}</option>
            ))}
          </select>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="bg-black/40 rounded-xl font-mono text-xs h-[500px] overflow-y-auto p-4 space-y-1">
              {isLoading ? (
                <p className="text-muted-foreground">Loading logs...</p>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <ScrollText className="w-8 h-8 mb-2 opacity-30" />
                  <p>No logs for selected job</p>
                </div>
              ) : (
                [...logs].reverse().map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 hover:bg-white/5 rounded px-2 py-1 transition-colors">
                    <span className="text-muted-foreground shrink-0">{formatDate(log.createdAt)}</span>
                    <span className="shrink-0">{LEVEL_ICONS[log.level] ?? LEVEL_ICONS.info}</span>
                    <span className={cn('uppercase text-[10px] font-bold shrink-0', LEVEL_CLASSES[log.level] ?? 'text-slate-400')}>
                      [{log.level}]
                    </span>
                    <span className="text-foreground/90 break-all">{log.message}</span>
                    {log.metadata && (
                      <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">
                        {JSON.stringify(log.metadata).slice(0, 60)}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
