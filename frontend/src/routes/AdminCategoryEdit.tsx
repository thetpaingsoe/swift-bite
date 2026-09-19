import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { listCategories, updateCategory } from "../api/items";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function AdminCategoryEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const category = data?.find((c) => c.id === id);

  const saveMutation = useMutation({
    mutationFn: (newName: string) => updateCategory(id!, newName),
    onSuccess: () => {
      toast.success("Category updated");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      navigate("/admin/categories");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Save failed");
    },
  });

  function save() {
    const value = (name ?? category?.name ?? "").trim();
    if (value.length < 1) {
      setError("Name is required.");
      return;
    }
    saveMutation.mutate(value);
  }

  if (!isPending && !category) {
    return (
      <div>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/admin/categories" className="cursor-pointer text-stone-500 hover:text-stone-900">
            Categories
          </Link>
          <span className="text-stone-300">/</span>
          <span className="font-medium text-stone-900">Edit Category</span>
        </nav>
        <p className="mt-6 text-sm text-red-600">Category not found.</p>
      </div>
    );
  }

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/admin/categories" className="cursor-pointer text-stone-500 hover:text-stone-900">
          Categories
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-900">Edit Category</span>
      </nav>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-stone-900">
        Edit category
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Rename this category. Menu items stay linked.
      </p>
      <div className="mt-8 max-w-md">
        <div>
          <label htmlFor="category-name" className="mb-2 block text-sm font-medium text-stone-900">
            Category name
          </label>
          <Input
            id="category-name"
            placeholder="e.g. Burgers"
            value={name ?? category?.name ?? ""}
            autoFocus
            disabled={isPending}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-6 flex gap-2">
          <Button disabled={saveMutation.isPending} onClick={save}>
            {saveMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
          <Link to="/admin/categories">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
