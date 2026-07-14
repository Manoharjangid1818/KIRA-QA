import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGenerateBugReport, useSaveArtifact } from "@/hooks/use-kira-api";
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
import { Loader2, Save, Bug, AlertTriangle, Info, ListTree } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  module: z.string().min(1, "Module name is required"),
  environment: z.string().min(1, "Environment is required"),
  description: z.string().min(10, "Please provide a description of the bug"),
  reproduction_steps: z.string().optional(),
});

export default function BugReports() {
  const { toast } = useToast();
  const generateMutation = useGenerateBugReport();
  const saveMutation = useSaveArtifact();
  
  const [result, setResult] = useState<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      module: "",
      environment: "",
      description: "",
      reproduction_steps: "",
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    generateMutation.mutate(
      { 
        module: data.module,
        environment: data.environment,
        description: data.description,
        reproduction_steps: data.reproduction_steps || ""
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
        artifact_type: "bug_report",
        title: result.title,
        input_data: form.getValues(),
        output_data: result,
      },
      {
        onSuccess: () => {
          toast({
            title: "Saved Successfully",
            description: "Bug report has been saved to your library.",
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

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'Critical': return "bg-red-600 text-white border-red-700";
      case 'High': return "bg-orange-500 text-white border-orange-600";
      case 'Medium': return "bg-yellow-400 text-yellow-950 border-yellow-500";
      case 'Low': return "bg-blue-400 text-white border-blue-500";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="flex h-full bg-background border rounded-tl-xl overflow-hidden mt-2 ml-2 shadow-sm">
      <div className="w-1/3 border-r bg-card flex flex-col min-w-[350px]">
        <div className="p-4 border-b bg-muted/30">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Bug className="w-5 h-5 text-primary" />
            Bug Report Generator
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Turn rough notes into structured, professional bug reports.
          </p>
        </div>
        <ScrollArea className="flex-1 p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="module"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Module</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Checkout" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="environment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Environment</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Staging, iOS 16" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rough Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What's happening? Be as messy as you need to be..." 
                        className="min-h-[150px] resize-y" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reproduction_steps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Known Repro Steps (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any steps you know? KIRA will try to fill in the gaps." 
                        className="min-h-[100px] resize-y" 
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
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Formatting Report...</>
                ) : (
                  "Format Bug Report"
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
              <Bug className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Awaiting Input</h3>
            <p className="max-w-sm mt-2">
              Fill out the form on the left to structure your bug report.
            </p>
          </div>
        )}

        {generateMutation.isPending && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-medium">Analyzing Issue...</h3>
            <p className="text-muted-foreground mt-2">Structuring steps, assessing severity, and finding gaps.</p>
          </div>
        )}

        {result && (
          <>
            <div className="p-4 border-b bg-card flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-semibold text-lg">Generated Bug Report</h3>
                <p className="text-sm text-muted-foreground">Review the structured output below.</p>
              </div>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Result
              </Button>
            </div>
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-4xl mx-auto space-y-6 pb-12">
                
                {result.information_required && result.information_required.length > 0 && (
                  <Card className="border-orange-300 bg-orange-50/50 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-orange-800 text-base flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Missing Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-orange-900/80 mb-3">
                        KIRA identified the following gaps in your description that are needed for a complete bug report:
                      </p>
                      <ul className="space-y-1">
                        {result.information_required.map((info: string, idx: number) => (
                          <li key={idx} className="text-sm font-medium text-orange-900 flex items-start gap-2">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></span>
                            {info}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <Card className="shadow-md border-t-4" style={{borderTopColor: result.severity === 'Critical' ? 'hsl(var(--destructive))' : result.severity === 'High' ? '#f97316' : '#eab308'}}>
                  <CardHeader className="pb-4">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge className={getSeverityColor(result.severity)}>Severity: {result.severity}</Badge>
                      <Badge variant="outline">Priority: {result.priority}</Badge>
                      <Badge variant="secondary" className="font-mono text-xs">{result.module}</Badge>
                      <Badge variant="secondary" className="font-mono text-xs">{result.environment}</Badge>
                    </div>
                    <CardTitle className="text-2xl">{result.title}</CardTitle>
                  </CardHeader>
                  
                  <Separator />
                  
                  <CardContent className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                        <Info className="w-4 h-4" /> Preconditions
                      </h4>
                      <p className="text-sm bg-secondary/20 p-3 rounded-md border">{result.preconditions || "None specified"}</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                        <ListTree className="w-4 h-4" /> Steps to Reproduce
                      </h4>
                      <div className="bg-card border rounded-md p-4">
                        <ol className="list-decimal list-inside space-y-2">
                          {result.steps_to_reproduce.map((step: string, idx: number) => (
                            <li key={idx} className="text-sm pl-2">{step}</li>
                          ))}
                        </ol>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-red-50/50 border border-red-100 rounded-md p-4">
                        <h4 className="text-sm font-semibold text-red-800 uppercase tracking-wider mb-2">Actual Result</h4>
                        <p className="text-sm text-red-900">{result.actual_result}</p>
                      </div>
                      <div className="bg-green-50/50 border border-green-100 rounded-md p-4">
                        <h4 className="text-sm font-semibold text-green-800 uppercase tracking-wider mb-2">Expected Result</h4>
                        <p className="text-sm text-green-900">{result.expected_result}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
