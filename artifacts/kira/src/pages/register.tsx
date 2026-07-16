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

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  full_name: z.string().min(2, "Full name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { register, user } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Redirect is handled by useAuth().redirectByRole
    if (user) {
      setLocation(user.role === "super_admin" || user.role === "admin" ? "/admin" : "/chat");
    }
  }, [user, setLocation]);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      full_name: "",
      password: "",
    },
  });

  const onSubmit = (data: RegisterForm) => {
    register.mutate(data, {
      onError: (error: Error) => {
        toast({
          title: "Registration Failed",
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
            Create an account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:text-primary/80">
              Sign in
            </Link>
          </p>

          <div className="mt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                  disabled={register.isPending}
                >
                  {register.isPending ? "Creating account..." : "Create account"}
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
              Elevate your testing strategy.
            </h1>
            <p className="text-sidebar-muted-foreground text-lg text-slate-400">
              Join thousands of QA engineers who have automated their documentation workflow with our intelligent copilot.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
