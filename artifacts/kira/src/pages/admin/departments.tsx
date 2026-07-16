import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users } from "lucide-react";

function DeptDialog({ open, onClose, dept, users }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!dept;
  const [form, setForm] = useState({
    name: dept?.name ?? "",
    description: dept?.description ?? "",
    manager_id: dept?.manager_id?.toString() ?? "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit
      ? apiFetch(`/admin/departments/${dept.id}`, { method: "PATCH", body: JSON.stringify(data) })
      : apiFetch("/admin/departments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "departments"] });
      toast({ title: isEdit ? "Department updated" : "Department created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Department" : "Create Department"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          <div><Label>Manager</Label>
            <Select value={form.manager_id || "none"} onValueChange={v => setForm(f => ({ ...f, manager_id: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {(users ?? []).map((u: any) => <SelectItem key={u.id} value={u.id.toString()}>{u.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate({ name: form.name, description: form.description, manager_id: form.manager_id ? parseInt(form.manager_id) : null })} disabled={mutation.isPending || !form.name}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDepartments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogDept, setDialogDept] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const deptsQuery = useQuery({ queryKey: ["admin","departments"], queryFn: () => apiFetch<any[]>("/admin/departments") });
  const usersQuery = useQuery({ queryKey: ["admin","users"], queryFn: () => apiFetch<any[]>("/admin/users") });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/departments/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin","departments"] }); toast({ title: "Department deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const depts = deptsQuery.data ?? [];
  const users = usersQuery.data ?? [];

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-sm text-muted-foreground">{depts.length} departments</p>
        </div>
        <Button onClick={() => { setDialogDept(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />Add Department
        </Button>
      </div>

      {deptsQuery.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : depts.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
          <p>No departments yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {depts.map(d => {
            const manager = users.find(u => u.id === d.manager_id);
            return (
              <Card key={d.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{d.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDialogDept(d); setDialogOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(d.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{d.member_count} members</span>
                    {manager && <span>Manager: <span className="font-medium text-foreground">{manager.full_name}</span></span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DeptDialog open={dialogOpen} onClose={() => setDialogOpen(false)} dept={dialogDept} users={users} />
    </div>
  );
}
