'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from 'recharts';
import { TrendingUp, Target, Zap } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

export default function MetricsPage() {
  const { data: metrics } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => api.metrics.dashboard(),
    refetchInterval: 15000,
  });

  const { data: throughput24 } = useQuery({
    queryKey: ['throughput', 24],
    queryFn: () => api.metrics.throughput(24),
    refetchInterval: 60000,
  });

  const { data: throughput7d } = useQuery({
    queryKey: ['throughput', 168],
    queryFn: () => api.metrics.throughput(168),
    refetchInterval: 300000,
  });

  const m = metrics as any;
  const data24 = (throughput24 as unknown as any[]) ?? [];
  const data7d = (throughput7d as unknown as any[]) ?? [];

  const chartStyle = {
    contentStyle: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 },
    labelStyle: { color: '#94a3b8' },
  };

  return (
    <div className="flex flex-col">
      <Header title="Metrics" subtitle="Performance insights and system health" />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Success Rate', value: `${m?.successRate ?? 0}%`, icon: Target, color: '#10b981' },
            { label: 'Avg Duration', value: formatDuration(m?.avgDurationMs ?? 0), icon: Zap, color: '#6366f1' },
            { label: 'Throughput/min', value: `~${Math.round((m?.completedJobs ?? 0) / Math.max(1, data24.length * 60))}`, icon: TrendingUp, color: '#a855f7' },
            { label: 'Dead Letter', value: m?.deadLetterCount ?? 0, icon: Target, color: '#ef4444' },
          ].map((kpi) => (
            <Card key={kpi.label} className="card-hover">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${kpi.color}20`, border: `1px solid ${kpi.color}30` }}>
                  <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 24h Throughput */}
        <Card>
          <CardHeader>
            <CardTitle>Throughput — Last 24 Hours</CardTitle>
          </CardHeader>
          <CardContent>
            {data24.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={(v) => new Date(v).getHours() + ':00'}
                  />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip {...chartStyle} />
                  <Legend />
                  <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[3,3,0,0]} />
                  <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[3,3,0,0]} />
                  <Bar dataKey="total" fill="#6366f1" name="Total" radius={[3,3,0,0]} opacity={0.4} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No data in the last 24 hours
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7 Day Trend */}
        <Card>
          <CardHeader>
            <CardTitle>7-Day Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {data7d.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data7d}>
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
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getMonth()+1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip {...chartStyle} />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#g1)" name="Jobs" />
                  <Line type="monotone" dataKey="avgDuration" stroke="#f59e0b" name="Avg ms" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground">
                Insufficient data for 7-day trend
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
