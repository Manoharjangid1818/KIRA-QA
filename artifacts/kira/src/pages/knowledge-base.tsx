import { useState, useRef } from "react";
import {
  useKnowledgeBases,
  useCreateKnowledgeBase,
  useDeleteKnowledgeBase,
  useKBDocuments,
  useUploadDocument,
  useDeleteDocument,
  useAskKnowledgeBase,
} from "@/hooks/use-kira-api";
import type { KnowledgeBase, KBDocument, RAGAnswer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  BookOpen,
  Plus,
  Upload,
  Trash2,
  FileText,
  Send,
  Loader2,
  Bot,
  ChevronRight,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

const STATUS_CONFIG = {
  uploaded:   { label: "Uploaded",   color: "bg-blue-500/10 text-blue-600 border-blue-200",   icon: Clock },
  processing: { label: "Processing", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: Loader2 },
  ready:      { label: "Ready",      color: "bg-green-500/10 text-green-600 border-green-200", icon: CheckCircle2 },
  failed:     { label: "Failed",     color: "bg-red-500/10 text-red-600 border-red-200",       icon: AlertCircle },
} as const;

function StatusBadge({ status }: { status: KBDocument["processing_status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.uploaded;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border", cfg.color)}>
      <Icon className={cn("w-3 h-3", status === "processing" && "animate-spin")} />
      {cfg.label}
    </span>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Create KB Dialog ──────────────────────────────────────────────────────────
function CreateKBDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const create = useCreateKnowledgeBase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), description: desc.trim() },
      {
        onSuccess: () => {
          setName(""); setDesc("");
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Knowledge Base</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name *</label>
            <Input
              placeholder="e.g. QA Testing Guidelines"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Optional description of this knowledge base"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Document Panel ────────────────────────────────────────────────────────────
function DocumentPanel({ kb, onAsk }: { kb: KnowledgeBase; onAsk: () => void }) {
  const { data: docs, isLoading } = useKBDocuments(kb.id);
  const upload = useUploadDocument(kb.id);
  const remove = useDeleteDocument(kb.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploadError("");
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync(file);
      } catch (err: any) {
        setUploadError(err.message ?? "Upload failed");
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{kb.name}</h2>
          {kb.description && <p className="text-sm text-muted-foreground">{kb.description}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.csv,.md,.markdown"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" />Upload Document</>
            )}
          </Button>
          <Button size="sm" onClick={onAsk}>
            <Bot className="w-4 h-4 mr-2" />Ask Knowledge Base
          </Button>
        </div>
      </div>

      {uploadError && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {uploadError}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4">
          <p className="text-xs text-muted-foreground mb-3">
            Supported: PDF, DOCX, TXT, CSV, Markdown · Max 20 MB per file
          </p>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : !docs?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <FileText className="w-12 h-12 text-muted-foreground/40" />
              <div>
                <p className="font-medium text-muted-foreground">No documents yet</p>
                <p className="text-sm text-muted-foreground">Upload documents to build this knowledge base</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{doc.file_name}</span>
                      <StatusBadge status={doc.processing_status} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground uppercase">{doc.file_type}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</span>
                    </div>
                    {doc.processing_status === "failed" && doc.error_message && (
                      <p className="text-xs text-red-600 mt-1">{doc.error_message}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-red-600"
                    onClick={() => remove.mutate(doc.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── RAG Chat Panel ────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: RAGAnswer["sources"];
}

function RAGChatPanel({ kb, onBack }: { kb: KnowledgeBase; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [allowGeneral, setAllowGeneral] = useState(false);
  const ask = useAskKnowledgeBase(kb.id);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || ask.isPending) return;
    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);

    ask.mutate(
      { question, allow_general_knowledge: allowGeneral },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.answer, sources: data.sources },
          ]);
          setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }, 50);
        },
        onError: (err: any) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Error: ${err.message ?? "Something went wrong."}` },
          ]);
        },
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 border-b flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <X className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-semibold">Ask: {kb.name}</h2>
          <p className="text-xs text-muted-foreground">Answers grounded in your uploaded documents</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Ask your knowledge base</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Ask any question and KIRA will answer using only your uploaded documents.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3 max-w-3xl",
              msg.role === "user" ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              msg.role === "user" ? "bg-sidebar-accent" : "bg-primary/10"
            )}>
              {msg.role === "user" ? (
                <span className="text-sm font-medium">U</span>
              ) : (
                <Bot className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="flex flex-col gap-2 min-w-0 max-w-[85%]">
              <div className={cn(
                "rounded-xl px-4 py-3 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border prose prose-sm dark:prose-invert max-w-none"
              )}>
                {msg.role === "user" ? (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                ) : (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                )}
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="bg-muted/60 border rounded-lg p-3 text-xs space-y-1.5">
                  <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Sources used</p>
                  {msg.sources.map((src, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <FileText className="w-3 h-3 shrink-0 mt-0.5 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{src.file_name}</span>
                        <span className="text-muted-foreground"> — chunk {src.chunk_index}</span>
                        <span className="ml-2 text-muted-foreground">(score: {src.similarity_score.toFixed(3)})</span>
                        <p className="text-muted-foreground mt-0.5 italic line-clamp-2">{src.chunk_text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {ask.isPending && (
          <div className="flex gap-3 max-w-3xl">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="rounded-xl px-4 py-3 bg-card border flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Searching documents…</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-background space-y-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={allowGeneral}
            onChange={(e) => setAllowGeneral(e.target.checked)}
            className="rounded"
          />
          Allow general knowledge when documents don't have the answer
        </label>
        <form onSubmit={handleSubmit} className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question based on your documents…"
            className="pr-12 py-6 text-base"
            disabled={ask.isPending}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 top-2 h-9 w-9 rounded-lg"
            disabled={!input.trim() || ask.isPending}
          >
            {ask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function KnowledgeBasePage() {
  const { data: kbs, isLoading } = useKnowledgeBases();
  const deleteKB = useDeleteKnowledgeBase();
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [chatKB, setChatKB] = useState<KnowledgeBase | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex h-full bg-background border rounded-tl-xl overflow-hidden mt-2 ml-2 shadow-sm">
      {/* Sidebar — KB list */}
      <div className="w-72 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <Button className="w-full justify-start gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            New Knowledge Base
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : !kbs?.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No knowledge bases yet
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {kbs.map((kb) => (
                <button
                  key={kb.id}
                  onClick={() => { setSelectedKB(kb); setChatKB(null); }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-md transition-colors flex items-center gap-2",
                    selectedKB?.id === kb.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{kb.name}</p>
                    <p className="text-xs text-muted-foreground">{kb.document_count} document{kb.document_count !== 1 ? "s" : ""}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 opacity-40" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-h-0">
        {!selectedKB ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-1">Knowledge Base</h2>
              <p className="text-muted-foreground max-w-md">
                Create a knowledge base, upload documents, and ask questions grounded in your own content.
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Knowledge Base
            </Button>
          </div>
        ) : chatKB ? (
          <RAGChatPanel kb={chatKB} onBack={() => setChatKB(null)} />
        ) : (
          <>
            <DocumentPanel
              kb={selectedKB}
              onAsk={() => setChatKB(selectedKB)}
            />
            <div className="p-3 border-t flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  deleteKB.mutate(selectedKB.id, {
                    onSuccess: () => setSelectedKB(null),
                  });
                }}
                disabled={deleteKB.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Knowledge Base
              </Button>
            </div>
          </>
        )}
      </div>

      <CreateKBDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
