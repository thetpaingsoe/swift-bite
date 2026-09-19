import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteCategory, listCategories, type Category } from "../api/items";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { cn } from "../lib/cn";

const PAGE_SIZE = 10;

type SortKey = "name" | "createdAt";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AdminCategories() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const deletion = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      toast.success("Category deleted");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
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
    const filtered = (data ?? []).filter((c) => c.name.toLowerCase().includes(q));
    const sorted = [...filtered].sort((a, b) => {
      const left = sortKey === "name" ? a.name.toLowerCase() : a.createdAt;
      const right = sortKey === "name" ? b.name.toLowerCase() : b.createdAt;
      if (left < right) return sortDir === "asc" ? -1 : 1;
      if (left > right) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, search, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function onSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Category</h1>
          <p className="mt-1 text-sm text-stone-500">
            {rows.length} {rows.length === 1 ? "category" : "categories"}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isError && (
        <p className="mt-4 text-sm text-red-600">
          Could not load categories. Check that item-service is running.
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
              <th className="px-4 py-3 font-medium">
                <button
                  className="inline-flex items-center gap-1 hover:text-stone-900"
                  onClick={() => toggleSort("createdAt")}
                >
                  Created
                  <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === "createdAt" ? "text-stone-900" : "text-stone-300")} />
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPending &&
              [0, 1, 2].map((i) => (
                <tr key={i} className="border-b border-stone-100 last:border-0">
                  <td colSpan={3} className="px-4 py-3">
                    <div className="h-5 animate-pulse rounded bg-stone-200" />
                  </td>
                </tr>
              ))}
            {!isPending &&
              pageRows.map((category) => (
                <tr
                  key={category.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                >
                  <td className="px-4 py-3 font-medium text-stone-900">{category.name}</td>
                  <td className="px-4 py-3 text-stone-500">{formatDate(category.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline"
                      className="cursor-pointer border-0 px-0 text-red-600 hover:bg-transparent hover:text-red-800"
                      onClick={() => setPendingDelete(category)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            {!isPending && pageRows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-stone-500">
                  {search ? `No categories match "${search}".` : "No categories yet."}
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
            <h2 className="text-lg font-semibold text-stone-900">Delete category?</h2>
            <p className="mt-2 text-sm text-stone-500">
              “{pendingDelete.name}” and all its menu items will be removed. This cannot be
              undone.
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
