'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDuration } from '@/lib/utils';

export default function AnalyticsPage() {
  const { data: throughput } = useQuery({
    queryKey: ['throughput', 24],
    queryFn: () => api.metrics.throughput(24),
    refetchInterval: 60000,
  });

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => api.metrics.dashboard(),
    refetchInterval: 15000,
  });

  const m = dashboard as any;
  const data = (throughput as unknown as any[]) ?? [];

  return (
    <div className="flex flex-col">
      <Header title="Analytics" subtitle="Execution trends and performance analytics" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Jobs', value: m?.totalJobs ?? 0 },
            { label: 'Completed', value: m?.completedJobs ?? 0 },
            { label: 'Failed', value: m?.failedJobs ?? 0 },
            { label: 'Avg Duration', value: formatDuration(m?.avgDurationMs ?? 0) },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="p-5 text-center">
                <p className="text-2xl font-bold text-foreground">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Job Throughput (24h)</CardTitle></CardHeader>
          <CardContent>
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v) => new Date(v).getHours() + 'h'}
                  />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#g1)" name="Jobs" />
                  <Area type="monotone" dataKey="completed" stroke="#10b981" fill="transparent" name="Completed" />
                  <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="transparent" name="Failed" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No throughput data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
