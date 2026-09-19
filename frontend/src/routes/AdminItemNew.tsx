import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createItem, listCategories, type ItemInput } from "../api/items";
import { ItemForm } from "../components/ItemForm";

export function AdminItemNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const creation = useMutation({
    mutationFn: createItem,
    onSuccess: () => {
      toast.success("Item added");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      navigate("/admin/items");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Create failed");
    },
  });

  function save(input: ItemInput) {
    creation.mutate(input);
  }

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/admin/items" className="cursor-pointer text-stone-500 hover:text-stone-900">
          Items
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-900">Add Item</span>
      </nav>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-stone-900">Add item</h1>
      <p className="mt-1 text-sm text-stone-500">
        Create a new menu item. It appears on the storefront right away.
      </p>
      {categoriesQuery.isError ? (
        <p className="mt-8 text-sm text-red-600">Could not load categories.</p>
      ) : (
        <ItemForm
          initial={{
            name: "",
            description: "",
            price: "",
            categoryId: "",
            imageUrl: "",
            available: true,
          }}
          categories={categoriesQuery.data ?? []}
          saving={creation.isPending}
          submitLabel="Add item"
          onSubmit={save}
        />
      )}
    </div>
  );
}
