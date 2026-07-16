import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, ShieldCheck } from "lucide-react";

function PermRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <Label className="text-sm cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function AdminAccessControl() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [perms, setPerms] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const usersQuery = useQuery({ queryKey: ["admin","users"], queryFn: () => apiFetch<any[]>("/admin/users") });

  const loadPerms = async (user: any) => {
    setSelectedUser(user);
    try {
      const p = await apiFetch<any>(`/admin/access-control/${user.id}`);
      setPerms(p);
    } catch {
      setPerms({ can_upload_files: true, can_use_image_analysis: true, can_access_company_knowledge: true, can_use_restricted_knowledge: false });
    }
  };

  const savePerms = async () => {
    if (!selectedUser || !perms) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/access-control/${selectedUser.id}`, { method: "PATCH", body: JSON.stringify(perms) });
      toast({ title: "Permissions saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const users = (usersQuery.data ?? []).filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Access Control</h1>
        <p className="text-sm text-muted-foreground">Manage per-user permissions. All permissions are enforced in the backend.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* User list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Select User</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search users…" className="pl-7 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto space-y-1 p-2">
            {usersQuery.isLoading ? <p className="text-xs text-muted-foreground p-2">Loading…</p> : users.map(u => (
              <button
                key={u.id}
                onClick={() => loadPerms(u)}
                className={`w-full text-left p-2 rounded-md transition-colors text-sm ${selectedUser?.id === u.id ? "bg-accent" : "hover:bg-accent/50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs capitalize flex-shrink-0">{u.role.replace(/_/g," ")}</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Permissions panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              {selectedUser ? `Permissions — ${selectedUser.full_name}` : "Select a user"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedUser ? (
              <p className="text-sm text-muted-foreground">Select a user from the list to manage their permissions.</p>
            ) : !perms ? (
              <p className="text-sm text-muted-foreground">Loading permissions…</p>
            ) : (
              <div className="space-y-1">
                <PermRow label="Can upload files" checked={perms.can_upload_files} onChange={v => setPerms((p: any) => ({ ...p, can_upload_files: v }))} />
                <PermRow label="Can use image analysis" checked={perms.can_use_image_analysis} onChange={v => setPerms((p: any) => ({ ...p, can_use_image_analysis: v }))} />
                <PermRow label="Can access company knowledge" checked={perms.can_access_company_knowledge} onChange={v => setPerms((p: any) => ({ ...p, can_access_company_knowledge: v }))} />
                <PermRow label="Can access restricted knowledge" checked={perms.can_use_restricted_knowledge} onChange={v => setPerms((p: any) => ({ ...p, can_use_restricted_knowledge: v }))} />
                <div className="pt-3">
                  <Button className="w-full" onClick={savePerms} disabled={saving}>
                    {saving ? "Saving…" : "Save Permissions"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
