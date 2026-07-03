'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { formatRelative } from '@/lib/utils';
import { useDashboardStore } from '@/store';

export default function DLQPage() {
  const queryClient = useQueryClient();
  const { selectedProjectId } = useDashboardStore();
  const [page, setPage] = useState(1);

  const { data: orgs } = useQuery({ queryKey: ['organizations'], queryFn: () => api.organizations.list() });
  const firstProject = ((orgs as unknown as any[]) ?? [])[0]?.projects?.[0];
  const projectId = selectedProjectId ?? firstProject?.id;

  const { data: dlqData, isLoading } = useQuery({
    queryKey: ['dlq', projectId, page],
    queryFn: () => api.dlq.list(projectId!, { page, limit: 20 }),
    enabled: !!projectId,
    refetchInterval: 10000,
  });

  const items = (dlqData as any)?.items ?? [];
  const total = (dlqData as any)?.total ?? 0;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dlq'] });

  const requeue = async (dlqId: string) => {
    await api.dlq.requeue(projectId!, dlqId);
    invalidate();
  };

  return (
    <div className="flex flex-col">
      <Header title="Dead Letter Queue" subtitle="Jobs that exhausted all retry attempts" />

      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-muted-foreground">{total} dead letter job(s)</p>
          </div>
          <Button size="sm" variant="outline" onClick={invalidate}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </div>

        {!projectId ? (
          <div className="text-center py-20 text-muted-foreground">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Create a project first</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <AlertTriangle className="w-12 h-12 mx-auto text-emerald-400/30 mb-4" />
            <h3 className="text-lg font-medium mb-2 text-emerald-400">All Clear!</h3>
            <p className="text-muted-foreground text-sm">No dead letter jobs — great job!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item: any) => (
              <Card key={item.id} className="card-hover border-red-900/30">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{item.job?.name}</h3>
                        <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">
                          DEAD
                        </span>
                        {item.requeued && (
                          <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            REQUEUED
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-red-300/80 mb-2">{item.reason}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Queue: {item.job?.queue?.name}</span>
                        <span>Retries: {item.retryCount}</span>
                        <span>Died: {formatRelative(item.createdAt)}</span>
                      </div>
                    </div>
                    {!item.requeued && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => requeue(item.id)}
                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Requeue
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
