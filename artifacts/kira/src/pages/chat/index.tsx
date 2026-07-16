import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, getToken, API_BASE } from "@/lib/api";
import type { Message, Conversation } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Send, Paperclip, Square, Copy, RotateCcw, ThumbsUp, ThumbsDown,
  X, FileText, ImageIcon, Bot, User, Sparkles, ChevronDown,
} from "lucide-react";

// Simple markdown renderer
function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_: string, lang: string, code: string) =>
      `<pre class="bg-muted rounded-md p-3 overflow-x-auto my-2 text-sm"><code class="language-${lang}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold text-base mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-semibold text-lg mt-4 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-xl mt-4 mb-2">$1</h1>')
    .replace(/^\s*[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\s*\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/(<li[\s\S]+<\/li>)/g, '<ul class="my-1 space-y-0.5">$1</ul>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>');
}

const EXAMPLE_PROMPTS = [
  { icon: "📄", label: "Summarize a document", prompt: "Please summarize the document I'm about to upload." },
  { icon: "🧪", label: "Generate test cases", prompt: "Generate test cases for a user login feature with email and password." },
  { icon: "🖼️", label: "Analyze a screenshot", prompt: "I'll upload a screenshot — please analyze it and identify any UI issues." },
  { icon: "✉️", label: "Write a professional email", prompt: "Help me write a professional email to reschedule a meeting." },
  { icon: "📚", label: "Explain a technical topic", prompt: "Explain the difference between unit testing and integration testing." },
  { icon: "🔍", label: "Search company knowledge", prompt: "What is our QA defect reporting process?" },
];

interface Attachment {
  id?: number;
  file: File;
  preview?: string;
  status: "pending" | "uploading" | "ready" | "failed";
  category: "document" | "image";
}

export default function ChatPage() {
  const { conversationId: convIdParam } = useParams<{ conversationId?: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const conversationId = convIdParam ? parseInt(convIdParam) : null;
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  // backend routes attachments to the right stack (text/vision/RAG) automatically
  const [sourceMode] = useState("auto");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load conversation messages
  const messagesQuery = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => conversationId
      ? apiFetch<{ id: number; title: string; messages: Message[] }>(`/conversations/${conversationId}`)
      : null,
    enabled: conversationId !== null,
  });

  const messages: Message[] = messagesQuery.data?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create conversation
  const createConvMutation = useMutation({
    mutationFn: (title: string) => apiFetch<Conversation>("/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  });

  // Send message
  const sendMutation = useMutation({
    mutationFn: async ({ convId, content, attachmentIds }: { convId: number; content: string; attachmentIds: number[] }) => {
      return apiFetch<any>(`/conversations/${convId}/messages`, {
        method: "POST",
    body: JSON.stringify({ content, attachment_ids: attachmentIds }),
      });
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["conversation", vars.convId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setAttachments([]);
    },
    onError: (e: any) => {
      toast({ title: "Failed to send message", description: e.message, variant: "destructive" });
    },
  });

  const handleSend = async () => {
    const content = input.trim();
    if (!content && attachments.length === 0) return;
    if (sendMutation.isPending) return;

    const attachmentIds = attachments.filter(a => a.status === "ready" && a.id).map(a => a.id!);
    setInput("");

    let convId = conversationId;
    if (!convId) {
      const conv = await createConvMutation.mutateAsync(content.slice(0, 60) || "New conversation");
      convId = conv.id;
      navigate(`/chat/${conv.id}`);
    }

    await sendMutation.mutateAsync({ convId, content, attachmentIds });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const category: "document" | "image" = isImage ? "image" : "document";

      const att: Attachment = {
        file,
        status: "uploading",
        category,
        preview: isImage ? URL.createObjectURL(file) : undefined,
      };
      setAttachments(prev => [...prev, att]);

      try {
        const token = getToken();
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`${API_BASE}/attachments/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.detail ?? "Upload failed");
        }
        const data = await res.json();
        setAttachments(prev => prev.map(a =>
          a.file === file ? { ...a, id: data.id, status: data.status === "ready" ? "ready" : "ready" } : a
        ));
      } catch (err: any) {
        setAttachments(prev => prev.map(a =>
          a.file === file ? { ...a, status: "failed" } : a
        ));
        toast({ title: `Failed to upload ${file.name}`, description: err.message, variant: "destructive" });
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const att = prev[index];
      if (att.preview) URL.revokeObjectURL(att.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard" });
  };

  const isLoading = sendMutation.isPending || createConvMutation.isPending;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Simple top bar (no KB/source selection in user panel) */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur-sm">
        <div className="text-xs text-muted-foreground">KIRA Chat</div>
        {conversationId && messagesQuery.data && (
          <span className="text-xs text-muted-foreground truncate max-w-48">{messagesQuery.data.title}</span>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {!conversationId || messages.length === 0 ? (
          /* Welcome screen */
          <div className="flex flex-col items-center justify-center h-full px-4 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-1">How can KIRA help you today?</h1>
            <p className="text-muted-foreground text-sm mb-8">AI assistant powered by Qwen3. Ask anything, upload documents, or analyze images.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl w-full">
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(ex.prompt); textareaRef.current?.focus(); }}
                  className="flex items-start gap-3 p-3 rounded-xl border bg-card hover:bg-accent/50 text-left transition-colors"
                >
                  <span className="text-xl flex-shrink-0">{ex.icon}</span>
                  <span className="text-sm font-medium">{ex.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-muted rounded-tl-none"
                )}>
                  {msg.role === "assistant" ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {/* Message actions */}
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/30">
                      <button onClick={() => copyMessage(msg.content)} className="p-1 rounded hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors" title="Copy">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors" title="Good response">
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors" title="Bad response">
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-background p-4">
        <div className="max-w-3xl mx-auto">
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {attachments.map((att, i) => (
                <div key={i} className="relative group flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm">
                  {att.category === "image" && att.preview ? (
                    <img src={att.preview} alt={att.file.name} className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div className="max-w-[120px]">
                    <p className="truncate text-xs font-medium">{att.file.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{att.status}</p>
                  </div>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="ml-1 p-0.5 rounded-full hover:bg-background text-muted-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative flex items-end gap-2 bg-muted rounded-2xl border px-3 py-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors flex-shrink-0"
              title="Attach file or image"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask KIRA anything… (Shift+Enter for new line)"
              className="flex-1 min-h-[40px] max-h-48 resize-none border-0 bg-transparent p-0 focus-visible:ring-0 text-sm placeholder:text-muted-foreground"
              rows={1}
            />

            <div className="flex items-center gap-1 flex-shrink-0">
              {isLoading ? (
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={() => {}} title="Stop">
                  <Square className="w-4 h-4 fill-current" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-xl"
                  onClick={handleSend}
                  disabled={!input.trim() && attachments.length === 0}
                  title="Send (Enter)"
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-2">
            KIRA may make mistakes. Verify important information.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.csv,.md,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
