import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, getToken, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, RefreshCw, Search, FileText } from "lucide-react";

function statusColor(status: string) {
  if (status === "ready") return "default";
  if (status === "failed") return "destructive";
  if (status === "processing") return "secondary";
  return "outline";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export default function AdminDocuments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedKb, setSelectedKb] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const docsQuery = useQuery({ queryKey: ["admin","documents"], queryFn: () => apiFetch<any[]>("/admin/documents"), refetchInterval: 5000 });
  const kbsQuery = useQuery({ queryKey: ["admin","kbs"], queryFn: () => apiFetch<any[]>("/admin/knowledge-bases") });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin","documents"] }); toast({ title: "Document deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reprocessMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/documents/${id}/reprocess`, { method: "POST" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin","documents"] }); toast({ title: "Document queued for reprocessing" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleUpload = async () => {
    if (!selectedFile || !selectedKb) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const token = getToken();
      const res = await fetch(`${API_BASE}/knowledge-bases/${selectedKb}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail ?? "Upload failed"); }
      queryClient.invalidateQueries({ queryKey: ["admin","documents"] });
      toast({ title: "Document uploaded" });
      setUploadOpen(false);
      setSelectedFile(null);
      setSelectedKb("");
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const docs = (docsQuery.data ?? []).filter(d =>
    d.file_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.knowledge_base_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground">{docsQuery.data?.length ?? 0} total documents</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-2">
          <Upload className="w-4 h-4" />Upload Document
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search documents…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Knowledge Base</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docsQuery.isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : docs.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />No documents found
              </TableCell></TableRow>
            ) : docs.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium text-sm max-w-[200px] truncate">{d.file_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.knowledge_base_name ?? "—"}</TableCell>
                <TableCell className="text-xs uppercase text-muted-foreground">{d.file_type}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatBytes(d.file_size)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{d.uploader_email ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={statusColor(d.processing_status) as any} className="text-xs">{d.processing_status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {d.processing_status === "failed" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Reprocess" onClick={() => reprocessMutation.mutate(d.id)}>
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(d.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={uploadOpen} onOpenChange={open => !open && setUploadOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload Document to Knowledge Base</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Knowledge Base</Label>
              <Select value={selectedKb} onValueChange={setSelectedKb}>
                <SelectTrigger><SelectValue placeholder="Select knowledge base" /></SelectTrigger>
                <SelectContent>{(kbsQuery.data ?? []).map(kb => <SelectItem key={kb.id} value={kb.id.toString()}>{kb.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>File (PDF, DOCX, TXT, CSV, MD)</Label>
              <Input type="file" accept=".pdf,.docx,.txt,.csv,.md" className="mt-1" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!selectedFile || !selectedKb || uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
