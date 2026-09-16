import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { login } from "../api/auth";
import { setSession } from "../store/auth-slice";
import { useAppDispatch } from "../store/store";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const res = await login(values.email, values.password);
      dispatch(
        setSession({
          user: { id: res.id, name: res.name, email: res.email, role: res.role },
          token: res.token,
        }),
      );
      toast.success(`Welcome back, ${res.name}`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? (res.role === "admin" ? "/admin" : "/"), { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">SwiftBite</h1>
        <p className="mt-1 text-sm text-stone-500">Log in to order food.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <Input type="email" placeholder="Email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <Input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Log in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
