import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGenerateRequirementAnalysis, useSaveArtifact } from "@/hooks/use-kira-api";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, FileText, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().min(1, "Title is required for saving").default("New Requirement Analysis"),
  requirement_text: z.string().min(10, "Please provide a more detailed requirement description"),
});

export default function RequirementAnalyzer() {
  const { toast } = useToast();
  const generateMutation = useGenerateRequirementAnalysis();
  const saveMutation = useSaveArtifact();
  
  const [result, setResult] = useState<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "New Requirement Analysis",
      requirement_text: "",
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    generateMutation.mutate(
      { requirement_text: data.requirement_text },
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
        artifact_type: "requirement_analysis",
        title: form.getValues().title,
        input_data: { requirement_text: form.getValues().requirement_text },
        output_data: result,
      },
      {
        onSuccess: () => {
          toast({
            title: "Saved Successfully",
            description: "Requirement analysis has been saved to your library.",
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

  return (
    <div className="flex h-full bg-background border rounded-tl-xl overflow-hidden mt-2 ml-2 shadow-sm">
      <div className="w-1/3 border-r bg-card flex flex-col min-w-[350px]">
        <div className="p-4 border-b bg-muted/30">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Requirement Analyzer
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Paste unstructured requirements to extract testable logic.
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
                    <FormLabel>Analysis Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Login Epic Analysis" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="requirement_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Raw Requirement Text</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Paste user story, epic description, or raw notes here..." 
                        className="min-h-[300px] resize-y" 
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
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                ) : (
                  "Generate Analysis"
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
              <FileText className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Awaiting Input</h3>
            <p className="max-w-sm mt-2">
              Fill out the form on the left and click generate to extract structured requirements.
            </p>
          </div>
        )}

        {generateMutation.isPending && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-medium">Extracting logic...</h3>
            <p className="text-muted-foreground mt-2">KIRA is identifying scenarios and edge cases.</p>
          </div>
        )}

        {result && (
          <>
            <div className="p-4 border-b bg-card flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-semibold text-lg">{form.getValues().title}</h3>
                <p className="text-sm text-muted-foreground">Generated Analysis</p>
              </div>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Result
              </Button>
            </div>
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-4xl mx-auto space-y-8 pb-12">
                <Card>
                  <CardHeader className="bg-primary/5 pb-4 border-b">
                    <CardTitle className="text-lg">Executive Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 text-sm leading-relaxed">
                    {result.summary}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        Functional Requirements
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {result.functional_requirements.map((req: string, i: number) => (
                          <li key={i} className="text-sm flex gap-2">
                            <span className="text-muted-foreground shrink-0">{i+1}.</span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-orange-500" />
                        Missing Information & Assumptions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {result.missing_information.length > 0 && (
                        <div>
                          <Badge variant="outline" className="mb-2 bg-orange-500/10 text-orange-700 border-orange-500/20">Missing</Badge>
                          <ul className="space-y-1">
                            {result.missing_information.map((item: string, i: number) => (
                              <li key={i} className="text-sm text-muted-foreground list-disc ml-4">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {result.assumptions.length > 0 && (
                        <div>
                          <Badge variant="outline" className="mb-2 bg-blue-500/10 text-blue-700 border-blue-500/20">Assumed</Badge>
                          <ul className="space-y-1">
                            {result.assumptions.map((item: string, i: number) => (
                              <li key={i} className="text-sm text-muted-foreground list-disc ml-4">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      Scenarios & Edge Cases
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-green-700 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div> Positive Path
                        </h4>
                        <ul className="grid gap-2 grid-cols-1 md:grid-cols-2">
                          {result.positive_scenarios.map((item: string, i: number) => (
                            <li key={i} className="text-sm p-2 bg-muted/50 rounded border">{item}</li>
                          ))}
                        </ul>
                      </div>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-red-700 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div> Negative Path
                        </h4>
                        <ul className="grid gap-2 grid-cols-1 md:grid-cols-2">
                          {result.negative_scenarios.map((item: string, i: number) => (
                            <li key={i} className="text-sm p-2 bg-muted/50 rounded border">{item}</li>
                          ))}
                        </ul>
                      </div>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-purple-700 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div> Edge Cases
                        </h4>
                        <ul className="grid gap-2 grid-cols-1 md:grid-cols-2">
                          {result.edge_cases.map((item: string, i: number) => (
                            <li key={i} className="text-sm p-2 bg-muted/50 rounded border">{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {(result.risks.length > 0 || result.questions_for_po.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {result.risks.length > 0 && (
                      <Card className="border-red-200">
                        <CardHeader className="bg-red-50 pb-3 border-b border-red-100">
                          <CardTitle className="text-base text-red-800 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Technical Risks
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <ul className="space-y-2">
                            {result.risks.map((item: string, i: number) => (
                              <li key={i} className="text-sm text-red-900/80 list-disc ml-4">{item}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {result.questions_for_po.length > 0 && (
                      <Card className="border-blue-200">
                        <CardHeader className="bg-blue-50 pb-3 border-b border-blue-100">
                          <CardTitle className="text-base text-blue-800 flex items-center gap-2">
                            <HelpCircle className="w-4 h-4" />
                            Questions for PO/BA
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <ul className="space-y-2">
                            {result.questions_for_po.map((item: string, i: number) => (
                              <li key={i} className="text-sm text-blue-900/80 list-disc ml-4">{item}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
