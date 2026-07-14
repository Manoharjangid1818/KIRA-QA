import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGenerateTestCases, useSaveArtifact } from "@/hooks/use-kira-api";
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
import { Loader2, Save, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  title: z.string().min(1, "Title is required for saving").default("Test Cases"),
  module: z.string().min(1, "Module name is required"),
  number_of_test_cases: z.coerce.number().min(1).max(20).default(5),
  requirement: z.string().min(10, "Please provide the requirement details"),
});

export default function TestCases() {
  const { toast } = useToast();
  const generateMutation = useGenerateTestCases();
  const saveMutation = useSaveArtifact();
  
  const [result, setResult] = useState<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "Test Cases",
      module: "",
      number_of_test_cases: 5,
      requirement: "",
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    generateMutation.mutate(
      { 
        module: data.module,
        number_of_test_cases: data.number_of_test_cases,
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
        artifact_type: "test_case",
        title: form.getValues().title,
        input_data: { 
          module: form.getValues().module,
          number_of_test_cases: form.getValues().number_of_test_cases,
          requirement: form.getValues().requirement 
        },
        output_data: result,
      },
      {
        onSuccess: () => {
          toast({
            title: "Saved Successfully",
            description: "Test cases have been saved to your library.",
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

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'High': return "bg-red-100 text-red-800 border-red-200";
      case 'Medium': return "bg-orange-100 text-orange-800 border-orange-200";
      case 'Low': return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="flex h-full bg-background border rounded-tl-xl overflow-hidden mt-2 ml-2 shadow-sm">
      <div className="w-1/3 border-r bg-card flex flex-col min-w-[350px]">
        <div className="p-4 border-b bg-muted/30">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            Test Case Generator
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate detailed, step-by-step test cases ready for execution.
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
                      <Input placeholder="e.g. Login Flow Tests" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="module"
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
                  name="number_of_test_cases"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Count</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={20} {...field} />
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
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Tests...</>
                ) : (
                  "Generate Test Cases"
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
              <CheckSquare className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Awaiting Input</h3>
            <p className="max-w-sm mt-2">
              Fill out the form on the left and click generate to create detailed test cases.
            </p>
          </div>
        )}

        {generateMutation.isPending && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-medium">Drafting Test Cases...</h3>
            <p className="text-muted-foreground mt-2">Writing preconditions, steps, and expected results.</p>
          </div>
        )}

        {result && (
          <>
            <div className="p-4 border-b bg-card flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-semibold text-lg">{form.getValues().title}</h3>
                <p className="text-sm text-muted-foreground">
                  {result.test_cases.length} test cases generated
                </p>
              </div>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Result
              </Button>
            </div>
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-4xl mx-auto space-y-6 pb-12">
                {result.test_cases.map((tc: any, idx: number) => (
                  <Card key={idx} className="overflow-hidden hover-elevate transition-all border-l-4" style={{borderLeftColor: tc.priority === 'High' ? 'hsl(var(--destructive))' : tc.priority === 'Medium' ? '#f97316' : '#3b82f6'}}>
                    <CardHeader className="bg-muted/20 pb-4 border-b flex flex-row items-start justify-between space-y-0">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-primary">{tc.test_case_id}</span>
                          <Badge variant="secondary" className="text-xs">{tc.test_type}</Badge>
                          <Badge variant="outline" className={getPriorityColor(tc.priority)}>{tc.priority}</Badge>
                        </div>
                        <CardTitle className="text-base leading-tight mt-2">{tc.objective}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1 space-y-4">
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Preconditions</h4>
                          <p className="text-sm text-foreground bg-secondary/30 p-2 rounded-md border">{tc.preconditions || "None"}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Test Data</h4>
                          <p className="text-sm text-foreground bg-secondary/30 p-2 rounded-md border font-mono text-xs">{tc.test_data || "N/A"}</p>
                        </div>
                      </div>
                      <div className="md:col-span-2 space-y-4">
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Execution Steps</h4>
                          <ol className="list-decimal list-inside space-y-2 ml-1">
                            {tc.steps.map((step: string, i: number) => (
                              <li key={i} className="text-sm text-foreground">{step}</li>
                            ))}
                          </ol>
                        </div>
                        <Separator />
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Expected Result</h4>
                          <p className="text-sm font-medium text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
                            {tc.expected_result}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
