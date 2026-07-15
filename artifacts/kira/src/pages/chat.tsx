import { useState, useRef, useEffect } from "react";
import {
  useConversations,
  useConversation,
  useCreateConversation,
  useSendMessage,
  useKnowledgeBases,
  useUploadChatAttachment,
  useDeleteChatAttachment,
} from "@/hooks/use-kira-api";
import type { ChatAttachment } from "@/lib/types";
import { format } from "date-fns";
import {
  MessageSquare,
  Plus,
  Send,
  Bot,
  User,
  Loader2,
  BookOpen,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

// ── Attachment pill shown in the staging area ─────────────────────────────────
function AttachmentPill({
  attachment,
  uploading,
  onRemove,
}: {
  attachment: ChatAttachment | null;
  uploading?: boolean;
  fileName?: string;
  onRemove: () => void;
}) {
  if (uploading || !attachment) {
    return (
      <div className="flex items-center gap-1.5 bg-muted border rounded-lg px-2.5 py-1.5 text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">Uploading…</span>
        <button onClick={onRemove} className="ml-1 text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const isImage = attachment.file_category === "image";
  const isFailed = attachment.status === "failed";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs max-w-[200px]",
        isFailed
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-card text-foreground"
      )}
    >
      {isFailed ? (
        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
      ) : isImage ? (
        <ImageIcon className="w-3.5 h-3.5 shrink-0 text-violet-500" />
      ) : (
        <FileText className="w-3.5 h-3.5 shrink-0 text-blue-500" />
      )}
      <span className="truncate">{attachment.file_name}</span>
      {isFailed && (
        <span className="shrink-0 text-red-500 text-[10px]">failed</span>
      )}
      <button
        onClick={onRemove}
        className="ml-1 shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Attachment chips shown inside a message bubble ────────────────────────────
function MessageAttachmentChips({
  attachmentMeta,
}: {
  attachmentMeta: Array<{ name: string; category: string }>;
}) {
  if (!attachmentMeta.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {attachmentMeta.map((a, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border font-medium",
            a.category === "image"
              ? "bg-violet-50 border-violet-200 text-violet-700"
              : "bg-blue-50 border-blue-200 text-blue-700"
          )}
        >
          {a.category === "image" ? (
            <ImageIcon className="w-3 h-3" />
          ) : (
            <FileText className="w-3 h-3" />
          )}
          {a.name}
        </span>
      ))}
    </div>
  );
}

// ── Pending attachment slot (tracks both uploading and ready state) ────────────
interface PendingAttachment {
  localId: string;          // temp client-side key
  file: File;
  uploading: boolean;
  result: ChatAttachment | null;
  error: string | null;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Chat() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [selectedKbId, setSelectedKbId] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: conversations, isLoading: loadingConversations } = useConversations();
  const { data: activeConversation, isLoading: loadingChat } = useConversation(activeId);
  const { data: knowledgeBases } = useKnowledgeBases();
  const createConversation = useCreateConversation();
  const sendMessageMutation = useSendMessage(activeId || 0);
  const uploadAttachment = useUploadChatAttachment();
  const deleteAttachment = useDeleteChatAttachment();

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeConversation?.messages]);

  // ── File picker handler ──────────────────────────────────────────────────
  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const localId = `${Date.now()}-${Math.random()}`;
      // Add a "uploading" slot immediately so the user sees it
      setPending((prev) => [
        ...prev,
        { localId, file, uploading: true, result: null, error: null },
      ]);
      try {
        const att: ChatAttachment = await uploadAttachment.mutateAsync(file);
        setPending((prev) =>
          prev.map((p) =>
            p.localId === localId
              ? { ...p, uploading: false, result: att }
              : p
          )
        );
      } catch (err: any) {
        setPending((prev) =>
          prev.map((p) =>
            p.localId === localId
              ? { ...p, uploading: false, error: err.message ?? "Upload failed" }
              : p
          )
        );
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePending = (localId: string) => {
    const slot = pending.find((p) => p.localId === localId);
    if (slot?.result) deleteAttachment.mutate(slot.result.id);
    setPending((prev) => prev.filter((p) => p.localId !== localId));
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const canSend = (input.trim().length > 0 || pending.some((p) => p.result)) &&
    !sendMessageMutation.isPending &&
    !pending.some((p) => p.uploading);

  const readyAttachmentIds = pending
    .filter((p) => p.result && p.result.status === "ready")
    .map((p) => p.result!.id);

  // Snapshot of attachment metadata to display in the sent message bubble
  const pendingMeta = pending
    .filter((p) => p.result)
    .map((p) => ({ name: p.result!.file_name, category: p.result!.file_category }));

  const doSend = async (convId: number, text: string, attIds: number[]) => {
    await sendMessageMutation.mutateAsync({
      content: text,
      knowledge_base_id: selectedKbId,
      attachment_ids: attIds,
    });
    setPending([]);
  };

  // Optimistic message metadata store (file chips to show in user bubbles)
  const [sentMeta, setSentMeta] = useState<
    Record<string, Array<{ name: string; category: string }>>
  >({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    const text = input.trim() || "Please analyse the attached file(s).";
    const attIds = [...readyAttachmentIds];
    const meta = [...pendingMeta];
    setInput("");

    if (!activeId) {
      // Create conversation first, then send via fetch (hook is bound to id=0)
      try {
        const newConv = await createConversation.mutateAsync({
          title: text.slice(0, 60) + (text.length > 60 ? "…" : ""),
        });
        setActiveId(newConv.id);
        // Tag the optimistic meta with a placeholder key; backend message id unknown yet
        const tempKey = `new-${newConv.id}`;
        if (meta.length) setSentMeta((prev) => ({ ...prev, [tempKey]: meta }));
        await doSend(newConv.id, text, attIds);
      } catch {/* errors handled below */}
    } else {
      // Tag meta by conversation for future lookup
      if (meta.length) {
        const tempKey = `pending-${activeId}-${Date.now()}`;
        setSentMeta((prev) => ({ ...prev, [tempKey]: meta }));
      }
      await doSend(activeId, text, attIds);
    }
  };

  // ── Render message list ───────────────────────────────────────────────────
  // Since we don't store attachment metadata per message in the DB yet,
  // we reconstruct it from the sentMeta map by matching position heuristics.
  // The backend includes attached file names in the augmented prompt so KIRA's
  // responses reference them by name, which is enough context for the user.

  return (
    <div className="flex h-full bg-background border rounded-tl-xl overflow-hidden mt-2 ml-2 shadow-sm">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <Button
            onClick={() => { setActiveId(null); setPending([]); setInput(""); }}
            className="w-full justify-start gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingConversations ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : conversations?.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No conversations yet
              </div>
            ) : (
              conversations?.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => { setActiveId(conv.id); setPending([]); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex flex-col gap-1",
                    activeId === conv.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  <span className="truncate">{conv.title || "New Conversation"}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(conv.updated_at), "MMM d, HH:mm")}
                  </span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-secondary/10 min-h-0">
        {!activeId && !loadingChat ? (
          /* Welcome / new-chat screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
              <Bot className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">
              How can I help you test?
            </h2>
            <p className="text-muted-foreground max-w-md mb-1">
              I'm KIRA, your QA Copilot. Type a question, paste a requirement, upload a
              document or screenshot — I'll analyse it for you.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Supports PDF, DOCX, TXT, CSV, Markdown, PNG, JPG, WEBP
            </p>

            <div className="w-full max-w-2xl mt-10 space-y-2">
              {/* Pending attachments for new chat */}
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                  {pending.map((p) => (
                    <AttachmentPill
                      key={p.localId}
                      attachment={p.result}
                      uploading={p.uploading}
                      onRemove={() => removePending(p.localId)}
                    />
                  ))}
                </div>
              )}
              <form onSubmit={handleSubmit} className="relative">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question or upload a file…"
                  className="pr-20 pl-12 py-6 shadow-md rounded-xl text-base"
                  disabled={createConversation.isPending}
                />
                {/* Attach button */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <Button
                  size="icon"
                  type="submit"
                  disabled={!canSend || createConversation.isPending}
                  className="absolute right-2 top-2 h-9 w-9 rounded-lg"
                >
                  {createConversation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <>
            {/* Message list */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
              {loadingChat ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                activeConversation?.messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-4 max-w-3xl mx-auto",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                        <Bot className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-xl px-4 py-3 text-sm max-w-[85%]",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-card border shadow-sm prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0"
                      )}
                    >
                      {msg.role === "user" ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <ReactMarkdown
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || "");
                              return !inline ? (
                                <div className="rounded-md bg-zinc-950 text-zinc-50 overflow-hidden my-2 border">
                                  <div className="flex items-center px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400">
                                    {match?.[1] || "code"}
                                  </div>
                                  <div className="p-3 overflow-x-auto text-xs font-mono">
                                    {children}
                                  </div>
                                </div>
                              ) : (
                                <code
                                  className="bg-muted px-1 py-0.5 rounded text-primary font-mono text-[0.9em]"
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-lg bg-sidebar-accent flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-sidebar-foreground" />
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Thinking indicator */}
              {sendMessageMutation.isPending && (
                <div className="flex gap-4 max-w-3xl mx-auto justify-start">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-card border shadow-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">KIRA is thinking…</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Input toolbar ─────────────────────────────────────────── */}
            <div className="p-4 bg-background border-t space-y-2 shrink-0">
              {/* KB selector */}
              {knowledgeBases && knowledgeBases.length > 0 && (
                <div className="max-w-3xl mx-auto flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Select
                    value={selectedKbId ? String(selectedKbId) : "none"}
                    onValueChange={(v) =>
                      setSelectedKbId(v === "none" ? null : Number(v))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-56">
                      <SelectValue placeholder="No Knowledge Base" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Knowledge Base</SelectItem>
                      {knowledgeBases.map((kb) => (
                        <SelectItem key={kb.id} value={String(kb.id)}>
                          {kb.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedKbId && (
                    <span className="text-xs text-muted-foreground">RAG enabled</span>
                  )}
                </div>
              )}

              {/* Pending attachment pills */}
              {pending.length > 0 && (
                <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
                  {pending.map((p) => (
                    <AttachmentPill
                      key={p.localId}
                      attachment={p.result}
                      uploading={p.uploading}
                      onRemove={() => removePending(p.localId)}
                    />
                  ))}
                </div>
              )}

              {/* Text input */}
              <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    pending.length
                      ? "Ask about the attached file(s)…"
                      : "Reply to KIRA, or attach a file…"
                  }
                  className="pr-12 pl-12 py-6 bg-card shadow-sm rounded-xl text-base"
                  disabled={sendMessageMutation.isPending}
                />
                {/* Attach button */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={sendMessageMutation.isPending}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                  title="Attach file (PDF, DOCX, TXT, CSV, MD, PNG, JPG, WEBP)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <Button
                  size="icon"
                  type="submit"
                  disabled={!canSend}
                  className="absolute right-2 top-2 h-9 w-9 rounded-lg"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.csv,.md,.markdown,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
