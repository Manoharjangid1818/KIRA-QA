import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Archive, Users } from "lucide-react";

function ProjectDialog({ open, onClose, project, users }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!project;
  const [form, setForm] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    manager_id: project?.manager_id?.toString() ?? "",
    status: project?.status ?? "active",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit
      ? apiFetch(`/admin/projects/${project.id}`, { method: "PATCH", body: JSON.stringify(data) })
      : apiFetch("/admin/projects", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin","projects"] });
      toast({ title: isEdit ? "Project updated" : "Project created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Project" : "Create Project"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          <div><Label>Project Manager</Label>
            <Select value={form.manager_id || "none"} onValueChange={v => setForm(f => ({ ...f, manager_id: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {(users ?? []).map((u: any) => <SelectItem key={u.id} value={u.id.toString()}>{u.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate({ name: form.name, description: form.description, manager_id: form.manager_id ? parseInt(form.manager_id) : null, status: form.status })}
            disabled={mutation.isPending || !form.name}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminProjects() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogProject, setDialogProject] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [membersProject, setMembersProject] = useState<any>(null);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  const projectsQuery = useQuery({ queryKey: ["admin","projects"], queryFn: () => apiFetch<any[]>("/admin/projects") });
  const usersQuery = useQuery({ queryKey: ["admin","users"], queryFn: () => apiFetch<any[]>("/admin/users") });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin","projects"] }); toast({ title: "Project deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, user_ids }: any) => apiFetch(`/admin/projects/${id}/members`, { method: "POST", body: JSON.stringify({ user_ids }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin","projects"] }); toast({ title: "Members updated" }); setMembersProject(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const projects = projectsQuery.data ?? [];
  const users = usersQuery.data ?? [];

  const openMembers = (p: any) => {
    setMembersProject(p);
    const existingIds = users.filter(u => u.project_ids?.includes(p.id)).map(u => u.id);
    setSelectedMembers(existingIds);
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">{projects.length} projects</p>
        </div>
        <Button onClick={() => { setDialogProject(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />New Project
        </Button>
      </div>

      {projectsQuery.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">No projects yet.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map(p => {
            const manager = users.find(u => u.id === p.manager_id);
            return (
              <Card key={p.id} className={p.status === "archived" ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      {p.status === "archived" && <Badge variant="secondary" className="text-xs"><Archive className="w-3 h-3 mr-1" />Archived</Badge>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openMembers(p)}>
                        <Users className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDialogProject(p); setDialogOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{p.member_count} members</span>
                    {manager && <span>PM: <span className="font-medium text-foreground">{manager.full_name}</span></span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} project={dialogProject} users={users} />

      <Dialog open={membersProject !== null} onOpenChange={open => !open && setMembersProject(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Manage Members — {membersProject?.name}</DialogTitle></DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {users.map(u => (
              <label key={u.id} className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(u.id)}
                  onChange={e => setSelectedMembers(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))}
                />
                <span>{u.full_name}</span>
                <span className="text-muted-foreground text-xs">{u.email}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersProject(null)}>Cancel</Button>
            <Button onClick={() => assignMutation.mutate({ id: membersProject.id, user_ids: selectedMembers })} disabled={assignMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
