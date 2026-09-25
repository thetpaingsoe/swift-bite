import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { updateProfile } from "../api/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { updateUser } from "../store/auth-slice";
import { useAppDispatch, useAppSelector } from "../store/store";

const schema = z.object({
  name: z.string().min(2, "Name needs at least 2 characters").max(100),
});

type FormValues = z.infer<typeof schema>;

export function ProfileEdit() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: { name: user?.name ?? "" },
  });

  async function onSubmit(values: FormValues) {
    try {
      const res = await updateProfile(values.name.trim());
      dispatch(updateUser({ name: res.name }));
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/profile" className="cursor-pointer text-stone-500 hover:text-stone-900">
          Profile
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-900">Edit name</span>
      </nav>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-stone-900">
        Edit name
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        This is the name shown on your orders and in the header menu.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-md space-y-4">
        <div>
          <Input placeholder="Name" autoComplete="name" {...field("name")} />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
          <Link to="/profile">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
