import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { register } from "../api/auth";
import { setSession } from "../store/auth-slice";
import { useAppDispatch } from "../store/store";
import { Button } from "../components/ui/button";
import { BrandLogo } from "../components/BrandLogo";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";

const schema = z.object({
  name: z.string().min(2, "Name needs at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password needs at least 8 characters")
    .regex(/[A-Z]/, "Password needs 1 uppercase letter")
    .regex(/[0-9]/, "Password needs 1 number")
    .regex(/[^A-Za-z0-9]/, "Password needs 1 special character"),
});

type FormValues = z.infer<typeof schema>;

export function Register() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const res = await register(values.name, values.email, values.password);
      dispatch(
        setSession({
          user: { id: res.id, name: res.name, email: res.email, role: res.role },
          token: res.token,
        }),
      );
      toast.success(`Welcome, ${res.name}`);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="text-2xl">
          <BrandLogo />
        </div>
        <p className="mt-1 text-sm text-stone-500">Join SwiftBite to order in seconds, save your addresses, and follow every delivery.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <Input placeholder="Name" autoComplete="name" {...field("name")} />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <Input type="email" placeholder="Email" autoComplete="email" {...field("email")} />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <Input
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              {...field("password")}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-stone-500">
          Have an account?{" "}
          <Link to="/login" className="font-medium text-stone-900 underline">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
