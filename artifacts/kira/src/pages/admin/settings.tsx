import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "lucide-react";

export default function AdminSettings() {
  const { toast } = useToast();

  const settingsQuery = useQuery({ queryKey: ["admin","settings"], queryFn: () => apiFetch<any>("/admin/settings") });
  const [form, setForm] = useState({
    app_name: "KIRA AI Assistant",
    max_file_size_mb: 20,
    max_attachments_per_message: 5,
    allowed_file_types: "pdf,docx,txt,csv,md,png,jpg,jpeg,webp",
    temp_file_retention_hours: 24,
    enable_file_upload: true,
    enable_image_upload: true,
    enable_general_knowledge: true,
    maintenance_mode: false,
  });

  useEffect(() => {
    if (settingsQuery.data) setForm(settingsQuery.data);
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: (data: any) => apiFetch("/admin/settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { settingsQuery.refetch(); toast({ title: "Settings saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Settings className="w-6 h-6" />
        <div>
          <h1 className="text-2xl font-bold">General Settings</h1>
          <p className="text-sm text-muted-foreground">Application-wide configuration</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Application Name</Label><Input value={form.app_name} onChange={e => setForm(f => ({ ...f, app_name: e.target.value }))} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">File Upload Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Max File Size (MB)</Label><Input type="number" value={form.max_file_size_mb} onChange={e => setForm(f => ({ ...f, max_file_size_mb: parseInt(e.target.value) || 20 }))} /></div>
            <div><Label>Max Attachments per Message</Label><Input type="number" value={form.max_attachments_per_message} onChange={e => setForm(f => ({ ...f, max_attachments_per_message: parseInt(e.target.value) || 5 }))} /></div>
          </div>
          <div><Label>Allowed File Types (comma-separated)</Label><Input value={form.allowed_file_types} onChange={e => setForm(f => ({ ...f, allowed_file_types: e.target.value }))} /></div>
          <div><Label>Temporary File Retention (hours)</Label><Input type="number" value={form.temp_file_retention_hours} onChange={e => setForm(f => ({ ...f, temp_file_retention_hours: parseInt(e.target.value) || 24 }))} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature Toggles</CardTitle>
          <CardDescription>Changes take effect immediately for all users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "enable_file_upload", label: "Enable file upload", desc: "Allow users to upload documents" },
            { key: "enable_image_upload", label: "Enable image upload", desc: "Allow users to upload images for vision analysis" },
            { key: "enable_general_knowledge", label: "Enable general AI knowledge", desc: "Allow AI to use its general knowledge beyond company documents" },
            { key: "maintenance_mode", label: "Maintenance mode", desc: "Prevent non-admin users from logging in" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={(form as any)[key]}
                onCheckedChange={v => setForm(f => ({ ...f, [key]: v }))}
                className={key === "maintenance_mode" && (form as any)[key] ? "data-[state=checked]:bg-destructive" : ""}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? "Saving…" : "Save All Settings"}
      </Button>
    </div>
  );
}
