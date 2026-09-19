import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { listCategories, listItems, updateItem, type ItemInput } from "../api/items";
import { ItemForm } from "../components/ItemForm";

export function AdminItemEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["items", "all"],
    queryFn: () => listItems(),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const item = itemsQuery.data?.find((i) => i.id === id);

  const saveMutation = useMutation({
    mutationFn: (input: ItemInput) => updateItem(id!, input),
    onSuccess: () => {
      toast.success("Item updated");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      navigate("/admin/items");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Save failed");
    },
  });

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/admin/items" className="cursor-pointer text-stone-500 hover:text-stone-900">
          Items
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-900">Edit Item</span>
      </nav>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-stone-900">Edit item</h1>
      <p className="mt-1 text-sm text-stone-500">
        Past orders keep their price snapshot. Only new orders see changes.
      </p>
      {itemsQuery.isPending || categoriesQuery.isPending ? (
        <div className="mt-8 h-64 max-w-md animate-pulse rounded-2xl bg-stone-200" />
      ) : !item ? (
        <p className="mt-8 text-sm text-red-600">Item not found.</p>
      ) : (
        <ItemForm
          key={item.id}
          initial={{
            name: item.name,
            description: item.description,
            price: String(item.price),
            categoryId: item.categoryId,
            imageUrl: item.imageUrl,
            available: item.available,
          }}
          categories={categoriesQuery.data ?? []}
          saving={saveMutation.isPending}
          submitLabel="Save changes"
          onSubmit={(input) => saveMutation.mutate(input)}
        />
      )}
    </div>
  );
}
