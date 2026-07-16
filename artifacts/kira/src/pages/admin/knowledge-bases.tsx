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
import { Plus, Trash2, BookOpen, FileText } from "lucide-react";

const KB_TYPES = ["company","department","project","restricted"];
const typeColor: Record<string, string> = {
  company: "default", department: "secondary", project: "outline", restricted: "destructive",
};

function KBDialog({ open, onClose, departments, projects }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", description: "", kb_type: "company", department_id: "", project_id: "" });

  const mutation = useMutation({
    mutationFn: (data: any) => apiFetch("/admin/knowledge-bases", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin","kbs"] }); toast({ title: "Knowledge base created" }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create Knowledge Base</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          <div><Label>Type</Label>
            <Select value={form.kb_type} onValueChange={v => setForm(f => ({ ...f, kb_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{KB_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.kb_type === "department" && (
            <div><Label>Department</Label>
              <Select value={form.department_id || "none"} onValueChange={v => setForm(f => ({ ...f, department_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(departments ?? []).map((d: any) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {form.kb_type === "project" && (
            <div><Label>Project</Label>
              <Select value={form.project_id || "none"} onValueChange={v => setForm(f => ({ ...f, project_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate({ name: form.name, description: form.description, kb_type: form.kb_type, department_id: form.department_id ? parseInt(form.department_id) : null, project_id: form.project_id ? parseInt(form.project_id) : null })} disabled={mutation.isPending || !form.name}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminKnowledgeBases() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const kbsQuery = useQuery({ queryKey: ["admin","kbs"], queryFn: () => apiFetch<any[]>("/admin/knowledge-bases") });
  const deptsQuery = useQuery({ queryKey: ["admin","departments"], queryFn: () => apiFetch<any[]>("/admin/departments") });
  const projectsQuery = useQuery({ queryKey: ["admin","projects"], queryFn: () => apiFetch<any[]>("/admin/projects") });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/knowledge-bases/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin","kbs"] }); toast({ title: "Knowledge base deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const kbs = kbsQuery.data ?? [];
  const depts = deptsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Bases</h1>
          <p className="text-sm text-muted-foreground">{kbs.length} knowledge bases</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />New Knowledge Base
        </Button>
      </div>

      {kbsQuery.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : kbs.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No knowledge bases yet. Create one to start adding documents.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {kbs.map(kb => {
            const dept = depts.find(d => d.id === kb.department_id);
            const project = projects.find(p => p.id === kb.project_id);
            return (
              <Card key={kb.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{kb.name}</CardTitle>
                      <Badge variant={typeColor[kb.kb_type] as any} className="text-xs capitalize">{kb.kb_type}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive flex-shrink-0" onClick={() => deleteMutation.mutate(kb.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {kb.description && <p className="text-sm text-muted-foreground">{kb.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{kb.document_count} docs</span>
                    {dept && <span>Dept: {dept.name}</span>}
                    {project && <span>Project: {project.name}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <KBDialog open={dialogOpen} onClose={() => setDialogOpen(false)} departments={depts} projects={projects} />
    </div>
  );
}
