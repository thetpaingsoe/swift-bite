import { useState } from "react";
import type { Category, ItemInput } from "../api/items";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/cn";

export interface ItemFormValues {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  imageUrl: string;
  available: boolean;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-stone-900">{label}</label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function ItemForm({
  initial,
  categories,
  saving,
  submitLabel,
  onSubmit,
}: {
  initial: ItemFormValues;
  categories: Category[];
  saving: boolean;
  submitLabel: string;
  onSubmit: (input: ItemInput) => void;
}) {
  const [values, setValues] = useState<ItemFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ItemFormValues, string>>>({});
  const [imgOk, setImgOk] = useState(true);

  function set<K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function save() {
    const next: Partial<Record<keyof ItemFormValues, string>> = {};
    if (values.name.trim().length < 1) next.name = "Name is required.";
    if (values.description.trim().length < 1) next.description = "Description is required.";
    const price = Number(values.price);
    if (!Number.isFinite(price) || price < 1)
      next.price = "Enter a price of at least 1.";
    if (!values.categoryId) next.categoryId = "Pick a category.";
    if (values.imageUrl.trim().length < 1) next.imageUrl = "Image URL is required.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      name: values.name.trim(),
      description: values.description.trim(),
      price: Math.round(price * 100) / 100,
      categoryId: values.categoryId,
      imageUrl: values.imageUrl.trim(),
      available: values.available,
    });
  }

  return (
    <div className="mt-8 max-w-md space-y-5">
      <Field label="Item name" error={errors.name}>
        <Input
          placeholder="e.g. Cheeseburger"
          value={values.name}
          autoFocus
          onChange={(e) => set("name", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
      </Field>

      <Field label="Description" error={errors.description}>
        <textarea
          placeholder="What makes it good..."
          value={values.description}
          rows={3}
          onChange={(e) => set("description", e.target.value)}
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Price" error={errors.price}>
          <Input
            type="number"
            min={1}
            step={0.01}
            placeholder="9.50"
            value={values.price}
            onChange={(e) => set("price", e.target.value)}
          />
        </Field>
        <Field label="Category" error={errors.categoryId}>
          <select
            value={values.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
            className={cn(
              "h-11 w-full cursor-pointer rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft",
              !values.categoryId && "text-stone-400",
            )}
          >
            <option value="">Pick one...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Image URL" error={errors.imageUrl}>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100 text-xs text-stone-400">
            {values.imageUrl && imgOk ? (
              <img
                src={values.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setImgOk(false)}
              />
            ) : (
              "No image"
            )}
          </div>
          <Input
            placeholder="https://..."
            value={values.imageUrl}
            onChange={(e) => {
              set("imageUrl", e.target.value);
              setImgOk(true);
            }}
          />
        </div>
      </Field>

      <label className="flex cursor-pointer items-center gap-3 text-sm text-stone-900">
        <input
          type="checkbox"
          checked={values.available}
          onChange={(e) => set("available", e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-orange-600"
        />
        Visible on the menu
      </label>

      <div className="flex gap-2 pt-1">
        <Button disabled={saving} onClick={save}>
          {saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
