import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createCategory } from "../api/items";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function AdminCategoryNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const creation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      toast.success("Category added");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      navigate("/admin/categories");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Create failed");
    },
  });

  function save() {
    if (name.trim().length < 1) {
      setError("Name is required.");
      return;
    }
    creation.mutate(name.trim());
  }

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/admin/categories" className="cursor-pointer text-stone-500 hover:text-stone-900">
          Categories
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-900">Add Category</span>
      </nav>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-stone-900">
        Add category
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Create a new category to organize menu items.
      </p>
      <div className="mt-8 max-w-md">
        <div>
          <label htmlFor="category-name" className="mb-2 block text-sm font-medium text-stone-900">
            Category name
          </label>
          <Input
            id="category-name"
            placeholder="e.g. Burgers"
            value={name}
            autoFocus
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
          <Button disabled={creation.isPending} onClick={save}>
            {creation.isPending ? "Adding..." : "Add category"}
          </Button>
          <Link to="/admin/categories">
            <Button variant="outline">Cancel</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
