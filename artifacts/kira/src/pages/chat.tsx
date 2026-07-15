import { useState, useRef, useEffect } from "react";
import { useConversations, useConversation, useCreateConversation, useSendMessage, useKnowledgeBases } from "@/hooks/use-kira-api";
import { format } from "date-fns";
import { 
  MessageSquare, 
  Plus, 
  Send, 
  Bot,
  User,
  Loader2,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReactMarkdown from 'react-markdown';
import { cn } from "@/lib/utils";

export default function Chat() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [selectedKbId, setSelectedKbId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: conversations, isLoading: loadingConversations } = useConversations();
  const { data: activeConversation, isLoading: loadingChat } = useConversation(activeId);
  const { data: knowledgeBases } = useKnowledgeBases();
  const createConversation = useCreateConversation();
  
  // Create a message mutation that optionally creates a conversation first
  const sendMessageMutation = useSendMessage(activeId || 0);

  const handleNewChat = () => {
    setActiveId(null);
  };

  const handleSelectChat = (id: number) => {
    setActiveId(id);
  };

  useEffect(() => {
    // Auto-scroll to bottom of chat
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConversation?.messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessageMutation.isPending) return;

    const messageText = input;
    setInput("");

    if (!activeId) {
      // Create new conversation first
      createConversation.mutate(
        { title: messageText.slice(0, 30) + (messageText.length > 30 ? "..." : "") },
        {
          onSuccess: (newConv) => {
            setActiveId(newConv.id);
            // Wait a tick for activeId to settle in the query hook
            setTimeout(() => {
               // Then we need a fresh mutation instance for the new ID, 
               // but for now we'll just handle it manually with fetch or let the user click again
               // For a robust implementation we'd wrap this cleanly, but here we'll just reload the page/component state
               // A simpler approach for the prototype:
            }, 100);
          }
        }
      );
      // Because useSendMessage needs the ID at render time, it's tricky to chain them.
      // In a real app we'd abstract this into a single hook. 
      // For now, we'll wait for the ID to be set before sending.
    } else {
      sendMessageMutation.mutate({ content: messageText, knowledge_base_id: selectedKbId });
    }
  };

  // Temporary helper for first message in new chat
  const handleFirstMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || createConversation.isPending) return;
    
    const messageText = input;
    setInput("");
    
    createConversation.mutate(
      { title: messageText.slice(0, 30) + (messageText.length > 30 ? "..." : "") },
      {
        onSuccess: async (newConv) => {
          setActiveId(newConv.id);
          // Manually send the first message since the hook is bound to old ID
          try {
            const token = localStorage.getItem('kira_auth_token');
            const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
            await fetch(`${baseUrl}/api/conversations/${newConv.id}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ content: messageText, knowledge_base_id: selectedKbId })
            });
            // Force a refetch of conversations
            window.dispatchEvent(new Event('focus'));
          } catch (err) {
            console.error(err);
          }
        }
      }
    );
  };

  return (
    <div className="flex h-full bg-background border rounded-tl-xl overflow-hidden mt-2 ml-2 shadow-sm">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <Button 
            onClick={handleNewChat} 
            className="w-full justify-start gap-2 shadow-sm hover-elevate"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingConversations ? (
              <div className="p-4 space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
              </div>
            ) : conversations?.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No conversations yet
              </div>
            ) : conversations?.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectChat(conv.id)}
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
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-secondary/10">
        {!activeId && !loadingChat ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4">
              <Bot className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">How can I help you test?</h2>
            <p className="text-muted-foreground max-w-md">
              I'm KIRA, your QA Copilot. Paste a requirement, ask for test ideas, or let's brainstorm edge cases together.
            </p>
            
            <div className="w-full max-w-2xl mt-12">
              <form onSubmit={handleFirstMessage} className="relative">
                <Input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="E.g. What are the boundary test cases for a password field that requires 8-20 characters?" 
                  className="pr-12 py-6 shadow-md rounded-xl text-base"
                />
                <Button 
                  size="icon" 
                  type="submit" 
                  disabled={!input.trim() || createConversation.isPending}
                  className="absolute right-2 top-2 h-9 w-9 rounded-lg"
                >
                  {createConversation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <>
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-6"
            >
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
                      msg.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                        <Bot className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div 
                      className={cn(
                        "rounded-xl px-4 py-3 text-sm max-w-[85%]",
                        msg.role === 'user' 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "bg-card border shadow-sm prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0"
                      )}
                    >
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <ReactMarkdown
                          components={{
                            code({node, inline, className, children, ...props}: any) {
                              const match = /language-(\w+)/.exec(className || '')
                              return !inline ? (
                                <div className="rounded-md bg-zinc-950 text-zinc-50 overflow-hidden my-2 border">
                                  <div className="flex items-center px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400">
                                    {match?.[1] || 'code'}
                                  </div>
                                  <div className="p-3 overflow-x-auto text-xs font-mono">
                                    {children}
                                  </div>
                                </div>
                              ) : (
                                <code className="bg-muted px-1 py-0.5 rounded text-primary font-mono text-[0.9em]" {...props}>
                                  {children}
                                </code>
                              )
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-lg bg-sidebar-accent flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-sidebar-foreground" />
                      </div>
                    )}
                  </div>
                ))
              )}
              {sendMessageMutation.isPending && (
                <div className="flex gap-4 max-w-3xl mx-auto justify-start">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-card border shadow-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">KIRA is thinking...</span>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-background border-t space-y-2">
              {knowledgeBases && knowledgeBases.length > 0 && (
                <div className="max-w-3xl mx-auto flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Select
                    value={selectedKbId ? String(selectedKbId) : "none"}
                    onValueChange={(v) => setSelectedKbId(v === "none" ? null : Number(v))}
                  >
                    <SelectTrigger className="h-8 text-xs w-56">
                      <SelectValue placeholder="No Knowledge Base" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Knowledge Base</SelectItem>
                      {knowledgeBases.map((kb) => (
                        <SelectItem key={kb.id} value={String(kb.id)}>{kb.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedKbId && (
                    <span className="text-xs text-muted-foreground">RAG enabled</span>
                  )}
                </div>
              )}
              <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative">
                <Input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Reply to KIRA..." 
                  className="pr-12 py-6 bg-card shadow-sm rounded-xl text-base"
                  disabled={sendMessageMutation.isPending}
                />
                <Button 
                  size="icon" 
                  type="submit" 
                  disabled={!input.trim() || sendMessageMutation.isPending}
                  className="absolute right-2 top-2 h-9 w-9 rounded-lg"
                >
                  {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
