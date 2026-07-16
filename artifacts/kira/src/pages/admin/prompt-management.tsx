import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Star } from "lucide-react";

const CATEGORIES = ["default","qa","development","hr","management","document_summary","image_analysis"];

function PromptDialog({ open, onClose, prompt }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!prompt;
  const [form, setForm] = useState({
    name: prompt?.name ?? "",
    category: prompt?.category ?? "default",
    content: prompt?.content ?? "",
    is_active: prompt?.is_active ?? true,
    is_default: prompt?.is_default ?? false,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit
      ? apiFetch(`/admin/prompts/${prompt.id}`, { method: "PATCH", body: JSON.stringify(data) })
      : apiFetch("/admin/prompts", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin","prompts"] });
      toast({ title: isEdit ? "Prompt updated" : "Prompt created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Prompt" : "Create Prompt"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g," ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>System Prompt Content</Label>
            <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={8} className="font-mono text-sm mt-1" placeholder="You are KIRA…" />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} id="active" />
              <Label htmlFor="active">Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_default} onCheckedChange={v => setForm(f => ({ ...f, is_default: v }))} id="default" />
              <Label htmlFor="default">Set as default for category</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.name || !form.content}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPrompts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogPrompt, setDialogPrompt] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const promptsQuery = useQuery({ queryKey: ["admin","prompts"], queryFn: () => apiFetch<any[]>("/admin/prompts") });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/prompts/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin","prompts"] }); toast({ title: "Prompt deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const prompts = promptsQuery.data ?? [];
  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = prompts.filter(p => p.category === cat);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prompt Management</h1>
          <p className="text-sm text-muted-foreground">System prompts are never exposed to users.</p>
        </div>
        <Button onClick={() => { setDialogPrompt(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />New Prompt
        </Button>
      </div>

      <div className="space-y-4">
        {CATEGORIES.map(cat => {
          const catPrompts = grouped[cat] ?? [];
          return (
            <div key={cat}>
              <h2 className="text-sm font-semibold capitalize mb-2 text-muted-foreground">{cat.replace(/_/g," ")}</h2>
              {catPrompts.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-2">No prompts in this category</p>
              ) : (
                <div className="space-y-2">
                  {catPrompts.map(p => (
                    <Card key={p.id} className={!p.is_active ? "opacity-60" : ""}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{p.name}</span>
                              {p.is_default && <Badge className="gap-1 text-xs"><Star className="w-3 h-3" />Default</Badge>}
                              {!p.is_active && <Badge variant="secondary" className="text-xs">Disabled</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 font-mono">{p.content}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDialogPrompt(p); setDialogOpen(true); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <PromptDialog open={dialogOpen} onClose={() => setDialogOpen(false)} prompt={dialogPrompt} />
    </div>
  );
}
