import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { AddressInput } from "../api/addresses";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const schema = z.object({
  label: z.string().min(1, "Label is required").max(50),
  street: z.string().min(1, "Street is required").max(255),
  area: z.string().min(1, "Area is required").max(255),
});

export type AddressFormValues = z.infer<typeof schema>;

export function AddressForm({
  initial,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<AddressFormValues>;
  saving: boolean;
  submitLabel: string;
  onSubmit: (input: AddressInput) => void;
  onCancel?: () => void;
}) {
  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(schema),
    values: {
      label: initial?.label ?? "",
      street: initial?.street ?? "",
      area: initial?.area ?? "",
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v) =>
        onSubmit({
          label: v.label.trim(),
          street: v.street.trim(),
          area: v.area.trim(),
        }),
      )}
      className="space-y-4"
    >
      <div>
        <label htmlFor="address-label" className="mb-2 block text-sm font-medium text-stone-900">
          Label
        </label>
        <Input
          id="address-label"
          placeholder="e.g. Home"
          autoComplete="off"
          {...field("label")}
        />
        {errors.label && (
          <p className="mt-1 text-sm text-red-600">{errors.label.message}</p>
        )}
      </div>
      <div>
        <label htmlFor="address-street" className="mb-2 block text-sm font-medium text-stone-900">
          Street
        </label>
        <Input id="address-street" {...field("street")} />
        {errors.street && (
          <p className="mt-1 text-sm text-red-600">{errors.street.message}</p>
        )}
      </div>
      <div>
        <label htmlFor="address-area" className="mb-2 block text-sm font-medium text-stone-900">
          Area
        </label>
        <Input id="address-area" {...field("area")} />
        {errors.area && (
          <p className="mt-1 text-sm text-red-600">{errors.area.message}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
