import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bot, Eye, Database, CheckCircle, XCircle, Loader2 } from "lucide-react";

function StatusBadge({ status }: { status: "ok" | "error" | "unknown" }) {
  if (status === "ok") return <Badge className="gap-1 bg-green-500"><CheckCircle className="w-3 h-3" />Connected</Badge>;
  if (status === "error") return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Error</Badge>;
  return <Badge variant="secondary">Unknown</Badge>;
}

export default function AdminAIConfig() {
  const { toast } = useToast();
  const [testStatus, setTestStatus] = useState<{ ai: "ok"|"error"|"unknown"; vision: "ok"|"error"|"unknown" }>({ ai: "unknown", vision: "unknown" });
  const [testing, setTesting] = useState({ ai: false, vision: false });

  // AI config
  const aiQuery = useQuery({ queryKey: ["admin","ai-config"], queryFn: () => apiFetch<any>("/admin/ai-config") });
  const [aiForm, setAiForm] = useState({ provider: "", model_name: "", base_url: "", api_key: "", temperature: 0.7, max_tokens: 4096, timeout: 120 });
  useEffect(() => { if (aiQuery.data) { setAiForm({ ...aiQuery.data, api_key: "" }); } }, [aiQuery.data]);

  const aiMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/admin/ai-config", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { aiQuery.refetch(); toast({ title: "AI configuration saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Vision config
  const visionQuery = useQuery({ queryKey: ["admin","vision-config"], queryFn: () => apiFetch<any>("/admin/vision-config") });
  const [visionForm, setVisionForm] = useState({ provider: "", model_name: "", base_url: "", api_key: "", timeout: 120, enabled: true });
  useEffect(() => { if (visionQuery.data) { setVisionForm({ ...visionQuery.data, api_key: "" }); } }, [visionQuery.data]);

  const visionMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/admin/vision-config", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { visionQuery.refetch(); toast({ title: "Vision configuration saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // RAG config
  const ragQuery = useQuery({ queryKey: ["admin","rag-config"], queryFn: () => apiFetch<any>("/admin/rag-config") });
  const [ragForm, setRagForm] = useState({ chunk_size: 500, chunk_overlap: 50, top_k: 5, embedding_provider: "", embedding_model: "", vector_db_provider: "" });
  useEffect(() => { if (ragQuery.data) setRagForm(ragQuery.data); }, [ragQuery.data]);

  const ragMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/admin/rag-config", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { ragQuery.refetch(); toast({ title: "RAG configuration saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const testAI = async () => {
    setTesting(t => ({ ...t, ai: true }));
    try {
      const r: any = await apiFetch("/admin/ai-config/test-connection", { method: "POST" });
      setTestStatus(s => ({ ...s, ai: r.status === "ok" ? "ok" : "error" }));
      toast({ title: r.status === "ok" ? "Connection successful" : "Connection failed", description: r.message });
    } finally { setTesting(t => ({ ...t, ai: false })); }
  };

  const testVision = async () => {
    setTesting(t => ({ ...t, vision: true }));
    try {
      const r: any = await apiFetch("/admin/vision-config/test-connection", { method: "POST" });
      setTestStatus(s => ({ ...s, vision: r.status === "ok" ? "ok" : "error" }));
      toast({ title: r.status === "ok" ? "Vision config OK" : "Vision config issue", description: r.message });
    } finally { setTesting(t => ({ ...t, vision: false })); }
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">AI Configuration</h1>
        <p className="text-sm text-muted-foreground">Configure text model, vision model, and RAG settings. API keys are never exposed after saving.</p>
      </div>

      <Tabs defaultValue="text">
        <TabsList>
          <TabsTrigger value="text" className="gap-2"><Bot className="w-4 h-4" />Text Model</TabsTrigger>
          <TabsTrigger value="vision" className="gap-2"><Eye className="w-4 h-4" />Vision Model</TabsTrigger>
          <TabsTrigger value="rag" className="gap-2"><Database className="w-4 h-4" />RAG Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Text Model (Qwen3 / vLLM)</CardTitle>
                <StatusBadge status={testStatus.ai} />
              </div>
              <CardDescription>{aiQuery.data?.has_api_key ? "API key is saved (hidden)" : "No API key configured"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Provider</Label><Input value={aiForm.provider} onChange={e => setAiForm(f => ({ ...f, provider: e.target.value }))} placeholder="Qwen" /></div>
                <div><Label>Model Name</Label><Input value={aiForm.model_name} onChange={e => setAiForm(f => ({ ...f, model_name: e.target.value }))} placeholder="Qwen3-7B" /></div>
              </div>
              <div><Label>Base URL</Label><Input value={aiForm.base_url} onChange={e => setAiForm(f => ({ ...f, base_url: e.target.value }))} placeholder="http://localhost:8000/v1" /></div>
              <div><Label>API Key (leave blank to keep existing)</Label><Input type="password" value={aiForm.api_key} onChange={e => setAiForm(f => ({ ...f, api_key: e.target.value }))} placeholder="sk-…" /></div>
              <div>
                <Label>Temperature: {aiForm.temperature}</Label>
                <Slider min={0} max={2} step={0.05} value={[aiForm.temperature]} onValueChange={([v]) => setAiForm(f => ({ ...f, temperature: v }))} className="mt-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Max Tokens</Label><Input type="number" value={aiForm.max_tokens} onChange={e => setAiForm(f => ({ ...f, max_tokens: parseInt(e.target.value) || 4096 }))} /></div>
                <div><Label>Timeout (s)</Label><Input type="number" value={aiForm.timeout} onChange={e => setAiForm(f => ({ ...f, timeout: parseInt(e.target.value) || 120 }))} /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => aiMutation.mutate(aiForm)} disabled={aiMutation.isPending}>Save Configuration</Button>
                <Button variant="outline" onClick={testAI} disabled={testing.ai}>
                  {testing.ai ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing…</> : "Test Connection"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vision">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Vision Model (Qwen3-VL)</CardTitle>
                <StatusBadge status={testStatus.vision} />
              </div>
              <CardDescription>{visionQuery.data?.has_api_key ? "API key is saved (hidden)" : "No API key configured"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b">
                <Label>Enable Image Analysis</Label>
                <Switch checked={visionForm.enabled} onCheckedChange={v => setVisionForm(f => ({ ...f, enabled: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Provider</Label><Input value={visionForm.provider} onChange={e => setVisionForm(f => ({ ...f, provider: e.target.value }))} placeholder="Qwen" /></div>
                <div><Label>Model Name</Label><Input value={visionForm.model_name} onChange={e => setVisionForm(f => ({ ...f, model_name: e.target.value }))} placeholder="Qwen3-VL" /></div>
              </div>
              <div><Label>Base URL</Label><Input value={visionForm.base_url} onChange={e => setVisionForm(f => ({ ...f, base_url: e.target.value }))} placeholder="http://localhost:8000/v1" /></div>
              <div><Label>API Key (leave blank to keep existing)</Label><Input type="password" value={visionForm.api_key} onChange={e => setVisionForm(f => ({ ...f, api_key: e.target.value }))} placeholder="sk-…" /></div>
              <div><Label>Timeout (s)</Label><Input type="number" value={visionForm.timeout} onChange={e => setVisionForm(f => ({ ...f, timeout: parseInt(e.target.value) || 120 }))} /></div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => visionMutation.mutate(visionForm)} disabled={visionMutation.isPending}>Save Configuration</Button>
                <Button variant="outline" onClick={testVision} disabled={testing.vision}>
                  {testing.vision ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testing…</> : "Test Connection"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rag">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">RAG Settings</CardTitle>
              <CardDescription>These settings are never visible to users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Chunk Size</Label><Input type="number" value={ragForm.chunk_size} onChange={e => setRagForm(f => ({ ...f, chunk_size: parseInt(e.target.value) || 500 }))} /></div>
                <div><Label>Chunk Overlap</Label><Input type="number" value={ragForm.chunk_overlap} onChange={e => setRagForm(f => ({ ...f, chunk_overlap: parseInt(e.target.value) || 50 }))} /></div>
              </div>
              <div><Label>Top K Results</Label><Input type="number" value={ragForm.top_k} onChange={e => setRagForm(f => ({ ...f, top_k: parseInt(e.target.value) || 5 }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Embedding Provider</Label><Input value={ragForm.embedding_provider} onChange={e => setRagForm(f => ({ ...f, embedding_provider: e.target.value }))} /></div>
                <div><Label>Embedding Model</Label><Input value={ragForm.embedding_model} onChange={e => setRagForm(f => ({ ...f, embedding_model: e.target.value }))} /></div>
              </div>
              <div><Label>Vector DB Provider</Label><Input value={ragForm.vector_db_provider} onChange={e => setRagForm(f => ({ ...f, vector_db_provider: e.target.value }))} /></div>
              <div className="pt-2">
                <Button onClick={() => ragMutation.mutate(ragForm)} disabled={ragMutation.isPending}>Save RAG Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
