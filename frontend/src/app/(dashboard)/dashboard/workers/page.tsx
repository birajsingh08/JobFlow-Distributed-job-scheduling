'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Cpu, MemoryStick, Activity, CheckCircle2, Clock } from 'lucide-react';
import { formatRelative, getWorkerStatusColor, cn } from '@/lib/utils';
import { getSocket } from '@/lib/socket';

function WorkerCard({ worker }: { worker: any }) {
  const statusColor = getWorkerStatusColor(worker.status);
  const isAlive = new Date(worker.lastHeartbeat).getTime() > Date.now() - 30000;
  const latestHeartbeat = worker.heartbeats?.[0];

  return (
    <Card className={cn('card-hover', !isAlive && 'opacity-60')}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center border',
              worker.status === 'BUSY' ? 'bg-amber-500/10 border-amber-500/30' :
              worker.status === 'IDLE' ? 'bg-blue-500/10 border-blue-500/30' :
              isAlive ? 'bg-emerald-500/10 border-emerald-500/30' :
              'bg-slate-500/10 border-slate-500/30',
            )}>
              <Server className={cn('w-5 h-5', statusColor)} />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{worker.name}</p>
              <p className="text-xs text-muted-foreground">{worker.hostname} · PID {worker.pid}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn('status-dot', worker.status.toLowerCase())} />
            <span className={cn('text-xs font-medium', statusColor)}>{worker.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-accent/30">
            <p className="text-lg font-bold text-foreground">{worker._count?.jobs ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Total Jobs</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-accent/30">
            <p className="text-lg font-bold text-foreground">{worker.concurrency}</p>
            <p className="text-[10px] text-muted-foreground">Concurrency</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-accent/30">
            <p className="text-lg font-bold text-foreground">{latestHeartbeat?.activeJobs ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </div>
        </div>

        {latestHeartbeat && (
          <div className="mt-3 pt-3 border-t border-border/20">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <MemoryStick className="w-3 h-3" />
                <span>{Math.round(latestHeartbeat.memoryUsage)} MB RAM</span>
              </div>
              <span className="text-muted-foreground">
                ❤️ {formatRelative(worker.lastHeartbeat)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function WorkersPage() {
  const queryClient = useQueryClient();

  const { data: workers, isLoading } = useQuery({
    queryKey: ['workers'],
    queryFn: () => api.workers.list(),
    refetchInterval: 10000,
  });

  const workerList = (workers as unknown as any[]) ?? [];

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['workers'] });
    socket.on('worker:died', refresh);
    return () => { socket.off('worker:died', refresh); };
  }, [queryClient]);

  const online = workerList.filter((w: any) => ['ONLINE', 'BUSY', 'IDLE'].includes(w.status));
  const offline = workerList.filter((w: any) => !['ONLINE', 'BUSY', 'IDLE'].includes(w.status));

  return (
    <div className="flex flex-col">
      <Header title="Workers" subtitle="Monitor distributed worker health and activity" />

      <div className="p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Online', value: online.length, color: 'text-emerald-400', icon: CheckCircle2 },
            { label: 'Total Workers', value: workerList.length, color: 'text-foreground', icon: Server },
            { label: 'Offline', value: offline.length, color: 'text-slate-500', icon: Clock },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-5 flex items-center gap-4">
                <s.icon className={cn('w-8 h-8', s.color)} />
                <div>
                  <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
          </div>
        ) : workerList.length === 0 ? (
          <div className="text-center py-20">
            <Server className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">No workers registered</h3>
            <p className="text-muted-foreground text-sm">Workers register automatically when the backend starts</p>
          </div>
        ) : (
          <>
            {online.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Online Workers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {online.map((w: any) => <WorkerCard key={w.id} worker={w} />)}
                </div>
              </div>
            )}
            {offline.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Offline Workers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {offline.map((w: any) => <WorkerCard key={w.id} worker={w} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
