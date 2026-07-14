import { useState } from "react";
import { useArtifacts, useArtifact, useDeleteArtifact } from "@/hooks/use-kira-api";
import { format } from "date-fns";
import { Link, useRoute } from "wouter";
import { 
  FileText, 
  ListTree, 
  CheckSquare, 
  Bug, 
  ShieldAlert,
  Search,
  Trash2,
  Calendar,
  ArrowLeft,
  Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SavedResults() {
  const [match, params] = useRoute("/saved-results/:id");
  const activeId = match && params?.id ? parseInt(params.id) : null;
  
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: artifacts, isLoading } = useArtifacts(filterType !== "all" ? filterType : undefined);
  const { data: activeArtifact, isLoading: isLoadingActive } = useArtifact(activeId);
  const deleteMutation = useDeleteArtifact();

  const getArtifactIcon = (type: string) => {
    switch(type) {
      case 'requirement_analysis': return <FileText className="w-5 h-5" />;
      case 'test_scenario': return <ListTree className="w-5 h-5" />;
      case 'test_case': return <CheckSquare className="w-5 h-5" />;
      case 'bug_report': return <Bug className="w-5 h-5" />;
      case 'security': return <ShieldAlert className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getArtifactLabel = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const filteredArtifacts = artifacts?.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
    if (activeId === id) {
      window.history.pushState({}, '', '/saved-results');
    }
  };

  // Render detail view if an ID is selected
  if (activeId) {
    if (isLoadingActive) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!activeArtifact) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <p>Artifact not found.</p>
          <Link href="/saved-results">
            <Button variant="link" className="mt-4">Back to Library</Button>
          </Link>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-background border rounded-tl-xl overflow-hidden mt-2 ml-2 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/saved-results">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                  {getArtifactLabel(activeArtifact.artifact_type)}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(activeArtifact.created_at), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight">{activeArtifact.title}</h1>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the saved artifact.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(activeArtifact.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <ScrollArea className="flex-1 p-6 bg-secondary/10">
          <div className="max-w-5xl mx-auto space-y-8 pb-12">
            <Card className="shadow-sm">
              <CardHeader className="bg-muted/30 pb-4 border-b">
                <CardTitle className="text-base font-medium">Original Input</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <pre className="text-sm bg-card border rounded-md p-4 overflow-x-auto font-mono text-muted-foreground">
                  {JSON.stringify(activeArtifact.input_data, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold tracking-tight px-1">Generated Output</h3>
              <Card className="shadow-sm border-primary/20">
                <CardContent className="p-0">
                  <pre className="text-sm bg-card rounded-md p-4 overflow-x-auto whitespace-pre-wrap font-mono">
                    {JSON.stringify(activeArtifact.output_data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // List View
  return (
    <div className="flex flex-col h-full bg-background border rounded-tl-xl overflow-hidden mt-2 ml-2 shadow-sm">
      <div className="p-6 border-b bg-card shrink-0 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Saved Artifacts</h1>
          <p className="text-muted-foreground mt-1">Browse and manage your generated QA documentation.</p>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Tabs defaultValue="all" value={filterType} onValueChange={setFilterType} className="w-full sm:w-auto overflow-x-auto">
            <TabsList className="h-10">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="requirement_analysis">Requirements</TabsTrigger>
              <TabsTrigger value="test_scenario">Scenarios</TabsTrigger>
              <TabsTrigger value="test_case">Test Cases</TabsTrigger>
              <TabsTrigger value="bug_report">Bug Reports</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search titles..." 
              className="pl-9 h-10" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-secondary/10 p-6">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredArtifacts?.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed rounded-xl bg-card">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-lg font-medium">No artifacts found</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              {searchQuery ? "Try adjusting your search or filters." : "You haven't saved any generated artifacts yet. Start generating from the sidebar."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto pb-8">
            {filteredArtifacts?.map((artifact) => (
              <Link href={`/saved-results/${artifact.id}`} key={artifact.id}>
                <Card className="h-full hover-elevate cursor-pointer transition-colors border hover:border-primary/50 group">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                        {getArtifactIcon(artifact.artifact_type)}
                      </div>
                      <Badge variant="secondary" className="text-xs capitalize font-medium">
                        {getArtifactLabel(artifact.artifact_type)}
                      </Badge>
                    </div>
                    
                    <h3 className="font-semibold text-lg line-clamp-2 mb-2 leading-tight group-hover:text-primary transition-colors">
                      {artifact.title}
                    </h3>
                    
                    <div className="mt-auto pt-4 flex items-center text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 mr-1.5" />
                      {format(new Date(artifact.created_at), "MMM d, yyyy")}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
