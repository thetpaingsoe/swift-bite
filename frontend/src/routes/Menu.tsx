import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listCategories, listItems } from "../api/items";
import { MenuCard } from "../components/MenuCard";
import { cn } from "../lib/cn";

export function Menu() {
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });
  const itemsQuery = useQuery({
    queryKey: ["items", categoryId ?? "all"],
    queryFn: () => listItems(categoryId),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Menu</h1>
      <p className="mt-1 text-sm text-stone-500">Fresh from local kitchens. Fill your cart and check out whenever you're ready.</p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategoryId(undefined)}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-medium",
            categoryId === undefined
              ? "bg-stone-900 text-white"
              : "bg-white text-stone-600 border border-stone-200",
          )}
        >
          All
        </button>
        {categoriesQuery.data?.map((category) => (
          <button
            key={category.id}
            onClick={() => setCategoryId(category.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium",
              categoryId === category.id
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-600 border border-stone-200",
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {itemsQuery.isPending && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-stone-200" />
          ))}
        </div>
      )}

      {itemsQuery.isError && (
        <p className="mt-6 text-sm text-red-600">
          Could not load the menu. Check that item-service is running.
        </p>
      )}

      {itemsQuery.data?.length === 0 && (
        <p className="mt-6 text-sm text-stone-500">No items in this category yet.</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {itemsQuery.data?.map((item) => (
          <MenuCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
