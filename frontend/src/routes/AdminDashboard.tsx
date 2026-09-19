import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { listCategories, listItems } from "../api/items";
import { listOrders } from "../api/orders";
import { Card } from "../components/ui/card";
import { cn } from "../lib/cn";

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: ReactNode;
  loading: boolean;
}) {
  return (
    <Card className="p-6">
      <p className="text-sm text-stone-500">{label}</p>
      <p className={cn("mt-2 text-3xl font-semibold text-stone-900", loading && "animate-pulse text-stone-200")}>
        {loading ? "–" : value}
      </p>
    </Card>
  );
}

export function AdminDashboard() {
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const itemsQuery = useQuery({ queryKey: ["items", "all"], queryFn: () => listItems() });
  const ordersQuery = useQuery({
    queryKey: ["orders", 1, "pending"],
    queryFn: () => listOrders(1, 1, "pending"),
  });
  const totalsQuery = useQuery({
    queryKey: ["orders", "totals"],
    queryFn: () => listOrders(1, 1),
  });

  const pendingCount = ordersQuery.data?.meta.total ?? 0;
  const totalCount = totalsQuery.data?.meta.total ?? 0;
  const failed = categoriesQuery.isError || itemsQuery.isError || ordersQuery.isError;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Dashboard</h1>
      <p className="mt-1 text-sm text-stone-500">Store overview at a glance.</p>

      {failed && (
        <p className="mt-4 text-sm text-red-600">
          Some numbers could not load. Check that the backend services are running.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Menu items"
          value={itemsQuery.data?.length ?? 0}
          loading={itemsQuery.isPending}
        />
        <StatCard
          label="Categories"
          value={categoriesQuery.data?.length ?? 0}
          loading={categoriesQuery.isPending}
        />
        <StatCard
          label="Total orders"
          value={totalCount}
          loading={totalsQuery.isPending}
        />
        <StatCard
          label="Pending orders"
          value={pendingCount}
          loading={ordersQuery.isPending}
        />
      </div>
    </div>
  );
}
