"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Plus,
  RefreshCw,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  formatRelative,
  getStatusColor,
  formatDuration,
  cn,
} from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import { useDashboardStore } from "@/store";

const JOB_STATUSES = [
  "ALL",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "RETRYING",
  "DEAD",
  "CANCELLED",
];
const JOB_TYPES = ["IMMEDIATE", "DELAYED", "CRON", "RECURRING", "BATCH"];

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        getStatusColor(status),
      )}
    >
      {status}
    </span>
  );
}

function CreateJobModal({
  queueId,
  onClose,
  onCreated,
}: {
  queueId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    type: "IMMEDIATE",
    priority: 5,
    payload: "{}",
    tags: "",
    maxRetries: 3,
    timeout: 30000,
    runAt: "",
    cronExpression: "",
    idempotencyKey: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let payload: any = {};
      try {
        payload = JSON.parse(form.payload);
      } catch {
        setError("Invalid JSON payload");
        setLoading(false);
        return;
      }

      await api.jobs.create(queueId, {
        name: form.name,
        type: form.type,
        priority: form.priority,
        payload,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
        maxRetries: form.maxRetries,
        timeout: form.timeout,
        runAt: form.runAt || undefined,
        cronExpression: form.cronExpression || undefined,
        idempotencyKey: form.idempotencyKey || undefined,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 shadow-2xl">
        <h3 className="text-lg font-semibold mb-4">Submit Job</h3>
        {error && (
          <p className="text-sm text-red-400 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1.5">
                Job Name *
              </label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="send-welcome-email"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Type</label>
              <select
                className="w-full h-9 rounded-lg border border-input bg-background/50 px-3 text-sm"
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value }))
                }
              >
                {JOB_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Priority (1-100)
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

          {form.type === "DELAYED" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Run At</label>
              <Input
                type="datetime-local"
                value={form.runAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, runAt: e.target.value }))
                }
              />
            </div>
          )}

          {form.type === "CRON" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Cron Expression
              </label>
              <Input
                value={form.cronExpression}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cronExpression: e.target.value }))
                }
                placeholder="0 9 * * *"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Payload (JSON)
            </label>
            <textarea
              className="w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm font-mono resize-y min-h-[80px]"
              value={form.payload}
              onChange={(e) =>
                setForm((f) => ({ ...f, payload: e.target.value }))
              }
              placeholder='{"key": "value"}'
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Tags (comma-sep)
              </label>
              <Input
                value={form.tags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tags: e.target.value }))
                }
                placeholder="email, marketing"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Max Retries
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.maxRetries}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxRetries: Number(e.target.value) }))
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Idempotency Key
            </label>
            <Input
              value={form.idempotencyKey}
              onChange={(e) =>
                setForm((f) => ({ ...f, idempotencyKey: e.target.value }))
              }
              placeholder="Optional unique key"
            />
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
              Submit Job
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const queryClient = useQueryClient();
  const { selectedProjectId } = useDashboardStore();
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedQueueId, setSelectedQueueId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

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

  const { data: queues } = useQuery({
    queryKey: ["queues", projectId],
    queryFn: () => api.queues.list(projectId!),
    enabled: !!projectId,
  });
  const queueList = (queues as unknown as any[]) ?? [];

  const targetQueueId = selectedQueueId || queueList[0]?.id;

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ["jobs", targetQueueId, selectedStatus, page],
    queryFn: () =>
      api.jobs.list(targetQueueId!, {
        status: selectedStatus === "ALL" ? undefined : selectedStatus,
        page,
        limit,
      }),
    enabled: !!targetQueueId,
    refetchInterval: 5000,
  });

  const jobs = (jobsData as any)?.jobs ?? [];
  const total = (jobsData as any)?.total ?? 0;
  const pages = Math.ceil(total / limit);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["jobs"] });

  // Real-time updates
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => invalidate();
    socket.on("job:created", refresh);
    socket.on("job:completed", refresh);
    socket.on("job:failed", refresh);
    socket.on("job:retrying", refresh);
    return () => {
      socket.off("job:created", refresh);
      socket.off("job:completed", refresh);
      socket.off("job:failed", refresh);
      socket.off("job:retrying", refresh);
    };
  }, []);

  const handleRetry = async (queueId: string, jobId: string) => {
    await api.jobs.retry(queueId, jobId);
    invalidate();
  };

  const handleCancel = async (queueId: string, jobId: string) => {
    if (!confirm("Cancel this job?")) return;
    await api.jobs.cancel(queueId, jobId, { reason: "Manually cancelled" });
    invalidate();
  };

  return (
    <div className="flex flex-col">
      <Header title="Jobs" subtitle="Monitor and manage all jobs" />

      <div className="p-6 space-y-5">
        {/* Controls */}
        <div className="flex flex-wrap gap-3">
          <select
            className="h-9 rounded-lg border border-input bg-background/50 px-3 text-sm"
            value={selectedQueueId}
            onChange={(e) => {
              setSelectedQueueId(e.target.value);
              setPage(1);
            }}
          >
            {queueList.map((q: any) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>

          <div className="flex gap-1">
            {JOB_STATUSES.slice(0, 6).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSelectedStatus(s);
                  setPage(1);
                }}
                className={cn(
                  "px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors",
                  selectedStatus === s
                    ? "bg-primary text-white"
                    : "bg-accent text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={invalidate}
            className="ml-auto"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>

          {targetQueueId && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Job
            </Button>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="skeleton h-12 rounded-lg" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-16">
                <Briefcase className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No jobs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                        Job
                      </th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                        Priority
                      </th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                        Retries
                      </th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                        Created
                      </th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job: any) => (
                      <tr
                        key={job.id}
                        className="border-b border-border/10 hover:bg-accent/20 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-foreground truncate max-w-[200px]">
                              {job.name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {job.id.slice(0, 8)}...
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">
                          {job.type}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {job.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">
                          {job.retryCount}/{job.maxRetries}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">
                          {formatRelative(job.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            {["FAILED", "DEAD", "CANCELLED"].includes(
                              job.status,
                            ) && (
                              <button
                                onClick={() => handleRetry(job.queueId, job.id)}
                                className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400 transition-colors text-xs"
                                title="Retry"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {["QUEUED", "SCHEDULED"].includes(job.status) && (
                              <button
                                onClick={() =>
                                  handleCancel(job.queueId, job.id)
                                }
                                className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                                title="Cancel"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/20">
                <p className="text-xs text-muted-foreground">
                  {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of{" "}
                  {total} jobs
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page === pages}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showCreate && targetQueueId && (
        <CreateJobModal
          queueId={targetQueueId}
          onClose={() => setShowCreate(false)}
          onCreated={invalidate}
        />
      )}
    </div>
  );
}
