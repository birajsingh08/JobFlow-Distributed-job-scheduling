'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  Briefcase,
  Server,
  List,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Activity,
  Zap,
} from 'lucide-react';
import { formatNumber, formatDuration } from '@/lib/utils';
import { useEffect } from 'react';
import { getSocket, subscribeToProject } from '@/lib/socket';
import { useQueryClient } from '@tanstack/react-query';

const COLORS = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  muted: '#64748b',
  purple: '#a855f7',
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  change?: string;
  subtitle?: string;
}

function StatCard({ title, value, icon, color, change, subtitle }: StatCardProps) {
  return (
    <Card className="card-hover">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{formatNumber(Number(value))}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {change && (
              <p className={`text-xs mt-1 ${change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>
                {change}
              </p>
            )}
          </div>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}30` }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="skeleton h-4 w-24 rounded mb-3" />
        <div className="skeleton h-8 w-16 rounded mb-2" />
        <div className="skeleton h-3 w-20 rounded" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const queryClient = useQueryClient();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => api.metrics.dashboard(),
    refetchInterval: 15000,
  });

  const { data: throughput } = useQuery({
    queryKey: ['throughput'],
    queryFn: () => api.metrics.throughput(24),
    refetchInterval: 60000,
  });

  const { data: workers } = useQuery({
    queryKey: ['workers-active'],
    queryFn: () => api.workers.active(),
    refetchInterval: 10000,
  });

  // Real-time updates
  useEffect(() => {
    const socket = getSocket();
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    socket.on('job:completed', invalidate);
    socket.on('job:failed', invalidate);
    socket.on('job:created', invalidate);
    return () => {
      socket.off('job:completed', invalidate);
      socket.off('job:failed', invalidate);
      socket.off('job:created', invalidate);
    };
  }, [queryClient]);

  const m = metrics as any;
  const workerList = (workers as unknown as any[]) ?? [];
  const throughputData = (throughput as unknown as any[]) ?? [];

  const pieData = m
    ? [
        { name: 'Completed', value: m.completedJobs, color: COLORS.success },
        { name: 'Failed', value: m.failedJobs, color: COLORS.danger },
        { name: 'Running', value: m.runningJobs, color: COLORS.primary },
        { name: 'Queued', value: m.queuedJobs, color: COLORS.warning },
      ]
    : [];

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" subtitle="System-wide overview and real-time metrics" />

      <div className="p-6 space-y-6">
        {/* Hero banner */}
        <div className="rounded-xl p-6 bg-gradient-to-r from-primary/20 via-purple-500/10 to-transparent border border-primary/20 glow-primary">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-6 h-6 text-primary animate-pulse" />
            <h2 className="text-xl font-bold gradient-text">JobFlow Platform</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Distributed job scheduling with real-time monitoring, automatic retries, and intelligent failure handling.
          </p>
          <div className="flex gap-4 mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{m?.successRate ?? 0}%</p>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{formatDuration(m?.avgDurationMs ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Avg Job Duration</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{m?.activeWorkers ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active Workers</p>
            </div>
          </div>
        </div>

        {/* Stat Grid */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard title="Total Jobs" value={m?.totalJobs ?? 0} icon={<Briefcase className="w-5 h-5" />} color={COLORS.primary} />
              <StatCard title="Running" value={m?.runningJobs ?? 0} icon={<Activity className="w-5 h-5" />} color={COLORS.primary} subtitle="Currently executing" />
              <StatCard title="Completed" value={m?.completedJobs ?? 0} icon={<CheckCircle2 className="w-5 h-5" />} color={COLORS.success} />
              <StatCard title="Failed" value={m?.failedJobs ?? 0} icon={<XCircle className="w-5 h-5" />} color={COLORS.danger} />
              <StatCard title="Queued" value={m?.queuedJobs ?? 0} icon={<Clock className="w-5 h-5" />} color={COLORS.warning} />
              <StatCard title="Workers Online" value={m?.activeWorkers ?? 0} icon={<Server className="w-5 h-5" />} color={COLORS.success} />
              <StatCard title="Active Queues" value={m?.totalQueues ?? 0} icon={<List className="w-5 h-5" />} color={COLORS.purple} />
              <StatCard title="Dead Letter" value={m?.deadLetterCount ?? 0} icon={<AlertTriangle className="w-5 h-5" />} color={COLORS.danger} subtitle="Needs attention" />
            </>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Throughput Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Job Throughput (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {throughputData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={throughputData}>
                    <defs>
                      <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(v) => new Date(v).getHours() + 'h'}
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <Area type="monotone" dataKey="completed" stroke={COLORS.success} fill="url(#gradCompleted)" name="Completed" />
                    <Area type="monotone" dataKey="failed" stroke={COLORS.danger} fill="url(#gradFailed)" name="Failed" />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  No throughput data yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Job Status</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.some((d) => d.value > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {pieData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                          <span className="text-muted-foreground">{d.name}</span>
                        </div>
                        <span className="font-medium text-foreground">{formatNumber(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  No jobs yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Workers Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Active Workers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workerList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Server className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No active workers</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Worker</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Active Jobs</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Last Heartbeat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerList.slice(0, 5).map((w: any) => (
                      <tr key={w.id} className="border-b border-border/10 hover:bg-accent/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <div>
                            <p className="font-medium text-foreground">{w.name}</p>
                            <p className="text-xs text-muted-foreground">{w.hostname}</p>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`status-dot ${w.status.toLowerCase()}`} />
                            <span className="text-xs">{w.status}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-foreground">{w._count?.jobs ?? 0}</span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">
                          {new Date(w.lastHeartbeat).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
