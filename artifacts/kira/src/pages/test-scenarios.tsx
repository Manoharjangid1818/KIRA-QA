import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGenerateTestScenarios, useSaveArtifact } from "@/hooks/use-kira-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, ListTree } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().min(1, "Title is required for saving").default("Test Scenarios"),
  module_name: z.string().min(1, "Module name is required"),
  feature_name: z.string().min(1, "Feature name is required"),
  requirement: z.string().min(10, "Please provide the requirement details"),
});

export default function TestScenarios() {
  const { toast } = useToast();
  const generateMutation = useGenerateTestScenarios();
  const saveMutation = useSaveArtifact();
  
  const [result, setResult] = useState<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "Test Scenarios",
      module_name: "",
      feature_name: "",
      requirement: "",
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    generateMutation.mutate(
      { 
        module_name: data.module_name,
        feature_name: data.feature_name,
        requirement: data.requirement 
      },
      {
        onSuccess: (data) => setResult(data),
        onError: (err) => {
          toast({
            title: "Generation Failed",
            description: err.message,
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleSave = () => {
    if (!result) return;
    
    saveMutation.mutate(
      {
        artifact_type: "test_scenario",
        title: form.getValues().title,
        input_data: { 
          module_name: form.getValues().module_name,
          feature_name: form.getValues().feature_name,
          requirement: form.getValues().requirement 
        },
        output_data: result,
      },
      {
        onSuccess: () => {
          toast({
            title: "Saved Successfully",
            description: "Test scenarios have been saved to your library.",
          });
        },
        onError: (err) => {
          toast({
            title: "Save Failed",
            description: err.message,
            variant: "destructive",
          });
        }
      }
    );
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'positive': return "bg-green-100 text-green-800 border-green-200";
      case 'negative': return "bg-red-100 text-red-800 border-red-200";
      case 'boundary': return "bg-blue-100 text-blue-800 border-blue-200";
      case 'edge_case': return "bg-purple-100 text-purple-800 border-purple-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'High': return "text-red-600 bg-red-50";
      case 'Medium': return "text-orange-600 bg-orange-50";
      case 'Low': return "text-blue-600 bg-blue-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <div className="flex h-full bg-background border rounded-tl-xl overflow-hidden mt-2 ml-2 shadow-sm">
      <div className="w-1/3 border-r bg-card flex flex-col min-w-[350px]">
        <div className="p-4 border-b bg-muted/30">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <ListTree className="w-5 h-5 text-primary" />
            Test Scenarios Generator
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a comprehensive list of high-level test scenarios.
          </p>
        </div>
        <ScrollArea className="flex-1 p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Collection Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Auth Scenarios" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="module_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Module</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Authentication" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="feature_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Feature</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Reset Password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="requirement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requirement Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Detail the requirement here..." 
                        className="min-h-[200px] resize-y" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full"
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Scenarios...</>
                ) : (
                  "Generate Scenarios"
                )}
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </div>

      <div className="flex-1 bg-secondary/10 flex flex-col overflow-hidden">
        {!result && !generateMutation.isPending && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-card border flex items-center justify-center mb-4 shadow-sm">
              <ListTree className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Awaiting Input</h3>
            <p className="max-w-sm mt-2">
              Fill out the form on the left and click generate to create test scenarios.
            </p>
          </div>
        )}

        {generateMutation.isPending && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-medium">Drafting Scenarios...</h3>
            <p className="text-muted-foreground mt-2">Brainstorming positive, negative, and edge cases.</p>
          </div>
        )}

        {result && (
          <>
            <div className="p-4 border-b bg-card flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-semibold text-lg">{form.getValues().title}</h3>
                <p className="text-sm text-muted-foreground">
                  {result.scenarios.length} scenarios generated
                </p>
              </div>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Result
              </Button>
            </div>
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-5xl mx-auto pb-12">
                <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[100px]">ID</TableHead>
                        <TableHead className="w-[250px]">Scenario Title</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[120px]">Type</TableHead>
                        <TableHead className="w-[100px]">Priority</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.scenarios.map((scenario: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {scenario.scenario_id}
                          </TableCell>
                          <TableCell className="font-medium">
                            {scenario.title}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {scenario.description}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getTypeColor(scenario.type)}>
                              {scenario.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getPriorityColor(scenario.priority)}>
                              {scenario.priority}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
