import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TerminalSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, user } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Redirect is handled by useAuth().redirectByRole
    if (user) {
      setLocation(user.role === "super_admin" || user.role === "admin" ? "/admin" : "/chat");
    }
  }, [user, setLocation]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginForm) => {
    login.mutate(data, {
      onError: (error: Error) => {
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex items-center gap-2 mb-8 text-primary font-bold text-2xl tracking-tight">
            <TerminalSquare className="w-8 h-8" />
            <span>KIRA<span className="text-foreground">.QA</span></span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Or{" "}
            <Link href="/register" className="font-medium text-primary hover:text-primary/80">
              create a new account
            </Link>
          </p>

          <div className="mt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={login.isPending}
                >
                  {login.isPending ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
      <div className="hidden lg:block relative w-0 flex-1 bg-sidebar">
        <div className="absolute inset-0 h-full w-full object-cover p-12 flex flex-col justify-between">
          <div className="flex-1 flex flex-col justify-center items-start text-sidebar-foreground space-y-6 max-w-lg">
            <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <TerminalSquare className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-4xl font-serif leading-tight">
              Intelligent Retrieval Assistant for QA Engineers.
            </h1>
            <p className="text-sidebar-muted-foreground text-lg text-slate-400">
              Stop drafting boilerplate test cases. Generate comprehensive requirement analyses, test scenarios, and bug reports in seconds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
