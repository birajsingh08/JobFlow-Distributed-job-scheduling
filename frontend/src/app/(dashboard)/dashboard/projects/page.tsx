'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FolderOpen, Plus, ChevronRight, Trash2, RefreshCw, Key } from 'lucide-react';
import { formatRelative } from '@/lib/utils';

function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.organizations.create({ name, description });
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
        <h3 className="text-lg font-semibold mb-4">Create Organization</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" loading={loading} className="flex-1">Create</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateProjectModal({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.organizations.createProject(orgId, { name, description });
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
        <h3 className="text-lg font-semibold mb-4">Create Project</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Email Campaign" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" loading={loading} className="flex-1">Create</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState<string | null>(null);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.organizations.list(),
  });

  const orgList = (orgs as unknown as any[]) ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['organizations'] });

  return (
    <div className="flex flex-col">
      <Header title="Projects" subtitle="Manage organizations and their projects" />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">{orgList.length} organization(s)</p>
          <Button onClick={() => setShowCreateOrg(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Organization
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-32 rounded-xl" />
            ))}
          </div>
        ) : orgList.length === 0 ? (
          <div className="text-center py-20">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No organizations yet</h3>
            <p className="text-muted-foreground mb-4">Create your first organization to get started</p>
            <Button onClick={() => setShowCreateOrg(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Organization
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orgList.map((org: any) => (
              <Card key={org.id} className="card-hover">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">{org.name}</h3>
                        <Badge variant="outline" className="text-xs">{org.slug}</Badge>
                      </div>
                      {org.description && (
                        <p className="text-sm text-muted-foreground mt-1">{org.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {org.members?.length ?? 0} members · {org._count?.projects ?? 0} projects
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCreateProject(org.id)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Project
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
                      >
                        <ChevronRight className={`w-4 h-4 transition-transform ${expandedOrg === org.id ? 'rotate-90' : ''}`} />
                      </Button>
                    </div>
                  </div>

                  {expandedOrg === org.id && org.projects && (
                    <div className="border-t border-border/30 pt-4 space-y-3">
                      {org.projects.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No projects yet</p>
                      ) : (
                        org.projects.map((project: any) => (
                          <div
                            key={project.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-accent/30 border border-border/20"
                          >
                            <div>
                              <p className="font-medium text-sm text-foreground">{project.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {project._count?.queues ?? 0} queues · Created {formatRelative(project.createdAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  await api.projects.regenerateKey(project.id);
                                  invalidate();
                                }}
                                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                title="Regenerate API Key"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreateOrg && (
        <CreateOrgModal onClose={() => setShowCreateOrg(false)} onCreated={invalidate} />
      )}
      {showCreateProject && (
        <CreateProjectModal
          orgId={showCreateProject}
          onClose={() => setShowCreateProject(null)}
          onCreated={invalidate}
        />
      )}
    </div>
  );
}
