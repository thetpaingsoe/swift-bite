import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { changePassword } from "../api/auth";
import { Button } from "../components/ui/button";
import { PasswordInput } from "../components/ui/password-input";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Password needs at least 8 characters")
      .regex(/[A-Z]/, "Password needs 1 uppercase letter")
      .regex(/[0-9]/, "Password needs 1 number")
      .regex(/[^A-Za-z0-9]/, "Password needs 1 special character"),
    confirmPassword: z.string().min(1, "Repeat the new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export function ProfilePassword() {
  const {
    register: field,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: FormValues) {
    try {
      await changePassword(values.currentPassword, values.newPassword);
      toast.success("Password changed");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password change failed");
    }
  }

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/profile" className="cursor-pointer text-stone-500 hover:text-stone-900">
          Profile
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-900">Change password</span>
      </nav>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-stone-900">
        Change password
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        You stay logged in on this device after changing it.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-md space-y-4">
        <div>
          <PasswordInput
            placeholder="Current password"
            autoComplete="current-password"
            {...field("currentPassword")}
          />
          {errors.currentPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.currentPassword.message}</p>
          )}
        </div>
        <div>
          <PasswordInput
            placeholder="New password"
            autoComplete="new-password"
            {...field("newPassword")}
          />
          {errors.newPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>
          )}
        </div>
        <div>
          <PasswordInput
            placeholder="Repeat new password"
            autoComplete="new-password"
            {...field("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Changing..." : "Change password"}
          </Button>
          <Link to="/profile">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
