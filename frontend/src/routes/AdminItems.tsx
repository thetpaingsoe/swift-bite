import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, Pencil, Plus, Search, Trash2, UtensilsCrossed } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { deleteItem, listCategories, listItems, type MenuItem } from "../api/items";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { cn } from "../lib/cn";

const PAGE_SIZE = 10;

type SortKey = "name" | "price" | "createdAt";

export function AdminItems() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<MenuItem | null>(null);

  const itemsQuery = useQuery({
    queryKey: ["items", "all"],
    queryFn: () => listItems(),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    (categoriesQuery.data ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categoriesQuery.data]);

  const deletion = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => {
      toast.success("Item deleted");
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setPendingDelete(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    },
  });

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = (itemsQuery.data ?? []).filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (categoryNames.get(item.categoryId) ?? "").toLowerCase().includes(q),
    );
    const sorted = [...filtered].sort((a, b) => {
      const left = sortKey === "name" ? a.name.toLowerCase() : a[sortKey];
      const right = sortKey === "name" ? b.name.toLowerCase() : b[sortKey];
      if (left < right) return sortDir === "asc" ? -1 : 1;
      if (left > right) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [itemsQuery.data, categoryNames, search, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const failed = itemsQuery.isError || categoriesQuery.isError;

  function onSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Item</h1>
          <p className="mt-1 text-sm text-stone-500">
            {rows.length} {rows.length === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Link to="/admin/items/new">
            <Button>
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </Link>
        </div>
      </div>

      {failed && (
        <p className="mt-4 text-sm text-red-600">
          Could not load items. Check that item-service is running.
        </p>
      )}

      <Card className="mt-4 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
              <th className="px-4 py-3 font-medium">
                <button
                  className="inline-flex items-center gap-1 hover:text-stone-900"
                  onClick={() => toggleSort("name")}
                >
                  Name
                  <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === "name" ? "text-stone-900" : "text-stone-300")} />
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">
                <button
                  className="inline-flex items-center gap-1 hover:text-stone-900"
                  onClick={() => toggleSort("price")}
                >
                  Price
                  <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === "price" ? "text-stone-900" : "text-stone-300")} />
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {itemsQuery.isPending &&
              [0, 1, 2].map((i) => (
                <tr key={i} className="border-b border-stone-100 last:border-0">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-5 animate-pulse rounded bg-stone-200" />
                  </td>
                </tr>
              ))}
            {!itemsQuery.isPending &&
              pageRows.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-stone-100">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <UtensilsCrossed className="h-4 w-4 text-stone-300" />
                        )}
                      </div>
                      <span className="font-medium text-stone-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {categoryNames.get(item.categoryId) ?? "–"}
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-900">${item.price}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-3 py-1 text-xs font-medium text-white",
                        item.available ? "bg-green-600" : "bg-stone-400",
                      )}
                    >
                      {item.available ? "Available" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-4">
                      <Link
                        to={`/admin/items/${item.id}/edit`}
                        className="inline-flex cursor-pointer items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Link>
                      <Button
                        variant="outline"
                        className="cursor-pointer border-0 px-0 text-red-600 hover:bg-transparent hover:text-red-800"
                        onClick={() => setPendingDelete(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            {!itemsQuery.isPending && pageRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-500">
                  {search ? `No items match "${search}".` : "No items yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-stone-500">
            Page {safePage} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="md"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="md"
              disabled={safePage >= pageCount}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4">
          <Card className="w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-stone-900">Delete item?</h2>
            <p className="mt-2 text-sm text-stone-500">
              “{pendingDelete.name}” will be removed from the menu. Past orders keep their
              snapshot. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={deletion.isPending}
                onClick={() => deletion.mutate(pendingDelete.id)}
              >
                {deletion.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
