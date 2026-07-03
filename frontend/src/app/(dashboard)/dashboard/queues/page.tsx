"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  List,
  Plus,
  Pause,
  Play,
  Trash2,
  BarChart2,
  ChevronRight,
} from "lucide-react";
import { formatRelative, cn } from "@/lib/utils";
import { useDashboardStore } from "@/store";

function QueueStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    ACTIVE: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    PAUSED: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    ARCHIVED: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        classes[status] ?? "",
      )}
    >
      {status}
    </span>
  );
}

function CreateQueueModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    maxConcurrency: 5,
    priority: 5,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.queues.create(projectId, form);
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-lg font-semibold mb-4">Create Queue</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="email-sender"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Description
            </label>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Concurrency
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.maxConcurrency}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxConcurrency: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Priority
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: Number(e.target.value) }))
                }
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              Create Queue
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function QueuesPage() {
  const queryClient = useQueryClient();
  const { selectedProjectId } = useDashboardStore();
  const [showCreate, setShowCreate] = useState(false);

  // For demo, use first available project
  const { data: orgs } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => api.organizations.list(),
  });

  const orgList = (orgs as unknown as any[]) ?? [];
  const firstOrgId = orgList[0]?.id;

  // Fetch projects for the first organization
  const { data: projects } = useQuery({
    queryKey: ["projects", firstOrgId],
    queryFn: () => api.organizations.listProjects(firstOrgId!),
    enabled: !!firstOrgId,
  });

  const projectList = (projects as unknown as any[]) ?? [];
  const firstProject = projectList[0];
  const projectId = selectedProjectId ?? firstProject?.id;

  const { data: queues, isLoading } = useQuery({
    queryKey: ["queues", projectId],
    queryFn: () => api.queues.list(projectId!),
    enabled: !!projectId,
    refetchInterval: 10000,
  });

  const queueList = (queues as unknown as any[]) ?? [];
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["queues", projectId] });

  const pause = async (queueId: string) => {
    await api.queues.pause(projectId!, queueId);
    invalidate();
  };

  const resume = async (queueId: string) => {
    await api.queues.resume(projectId!, queueId);
    invalidate();
  };

  const deleteQueue = async (queueId: string) => {
    if (!confirm("Delete this queue and all its jobs?")) return;
    await api.queues.delete(projectId!, queueId);
    invalidate();
  };

  return (
    <div className="flex flex-col">
      <Header
        title="Queues"
        subtitle="Manage job queues and their configurations"
      />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {queueList.length} queue(s) in project
          </p>
          {projectId && (
            <Button
              onClick={() => setShowCreate(true)}
              size="sm"
              disabled={!projectId}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Queue
            </Button>
          )}
        </div>

        {!projectId ? (
          <div className="text-center py-20">
            <List className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              Create a project first to manage queues
            </p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        ) : queueList.length === 0 ? (
          <div className="text-center py-20">
            <List className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">No queues yet</h3>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Queue
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {queueList.map((q: any) => (
              <Card key={q.id} className="card-hover">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <List className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">
                            {q.name}
                          </h3>
                          <QueueStatusBadge status={q.status} />
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Concurrency: {q.maxConcurrency}</span>
                          <span>Priority: {q.priority}</span>
                          <span>Jobs: {q._count?.jobs ?? 0}</span>
                          <span>Created {formatRelative(q.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {q.status === "ACTIVE" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pause(q.id)}
                        >
                          <Pause className="w-3.5 h-3.5 mr-1" />
                          Pause
                        </Button>
                      ) : q.status === "PAUSED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resume(q.id)}
                        >
                          <Play className="w-3.5 h-3.5 mr-1" />
                          Resume
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteQueue(q.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Mini stats */}
                  {q.metrics?.[0] && (
                    <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/20">
                      {[
                        {
                          label: "Completed",
                          value: q.metrics[0].completedJobs,
                          color: "text-emerald-400",
                        },
                        {
                          label: "Failed",
                          value: q.metrics[0].failedJobs,
                          color: "text-red-400",
                        },
                        {
                          label: "Pending",
                          value: q.metrics[0].pendingJobs,
                          color: "text-amber-400",
                        },
                        {
                          label: "Avg ms",
                          value: Math.round(q.metrics[0].avgDuration),
                          color: "text-blue-400",
                        },
                      ].map((s) => (
                        <div key={s.label} className="text-center">
                          <p className={`text-lg font-bold ${s.color}`}>
                            {s.value}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {s.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreate && projectId && (
        <CreateQueueModal
          projectId={projectId}
          onClose={() => setShowCreate(false)}
          onCreated={invalidate}
        />
      )}
    </div>
  );
}
