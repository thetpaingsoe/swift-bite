import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, Eye, RefreshCw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { cancelOrder, listOrders, type Order } from "../api/orders";
import { StatusBadge, statusLabel } from "../components/OrderStatus";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { cn } from "../lib/cn";

const tabs = ["all", "pending", "cooking", "ready", "dispatched", "cancelled"] as const;
type Tab = (typeof tabs)[number];
type SortKey = "createdAt" | "totalPrice" | "customerName";

const PAGE_SIZE = 10;

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function matchesSearch(order: Order, q: string) {
  if (!q) return true;
  const hay = `${order.customerName} ${order.id} ${order.street} ${order.area}`.toLowerCase();
  return hay.includes(q);
}

export function AdminOrders() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pendingCancel, setPendingCancel] = useState<Order | null>(null);

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ["orders", page, tab],
    queryFn: () => listOrders(page, PAGE_SIZE, tab === "all" ? undefined : tab),
    placeholderData: keepPreviousData,
  });

  const cancellation = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => {
      toast.success("Order cancelled");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setPendingCancel(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    },
  });

  function selectTab(t: Tab) {
    setTab(t);
    setPage(1);
  }

  function onSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = (data?.data ?? []).filter((o) => matchesSearch(o, q));
    const sorted = [...filtered].sort((a, b) => {
      const left =
        sortKey === "customerName"
          ? a.customerName.toLowerCase()
          : sortKey === "totalPrice"
            ? Number(a.totalPrice)
            : a.createdAt;
      const right =
        sortKey === "customerName"
          ? b.customerName.toLowerCase()
          : sortKey === "totalPrice"
            ? Number(b.totalPrice)
            : b.createdAt;
      if (left < right) return sortDir === "asc" ? -1 : 1;
      if (left > right) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, search, sortKey, sortDir]);

  const total = data?.meta.total ?? 0;
  const pageCount = data?.meta.pageCount ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Orders</h1>
          <p className="mt-1 text-sm text-stone-500">
            {total} {total === 1 ? "order" : "orders"} across all customers
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              placeholder="Search customer, id, address..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={refresh} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => selectTab(t)}
            className={cn(
              "shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm font-medium capitalize",
              tab === t
                ? "bg-stone-900 text-white"
                : "border border-stone-200 bg-white text-stone-600",
            )}
          >
            {statusLabel(t)}
          </button>
        ))}
      </div>

      {isError && (
        <p className="mt-4 text-sm text-red-600">
          Could not load orders. Check that orders-service is running.
        </p>
      )}

      <Card className="mt-4 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">
                <button
                  className="inline-flex items-center gap-1 hover:text-stone-900"
                  onClick={() => toggleSort("customerName")}
                >
                  Customer
                  <ArrowUpDown
                    className={cn(
                      "h-3.5 w-3.5",
                      sortKey === "customerName" ? "text-stone-900" : "text-stone-300",
                    )}
                  />
                </button>
              </th>
              <th className="px-4 py-3 font-medium">
                <button
                  className="inline-flex items-center gap-1 hover:text-stone-900"
                  onClick={() => toggleSort("totalPrice")}
                >
                  Total
                  <ArrowUpDown
                    className={cn(
                      "h-3.5 w-3.5",
                      sortKey === "totalPrice" ? "text-stone-900" : "text-stone-300",
                    )}
                  />
                </button>
              </th>
              <th className="px-4 py-3 font-medium">
                <button
                  className="inline-flex items-center gap-1 hover:text-stone-900"
                  onClick={() => toggleSort("createdAt")}
                >
                  Placed
                  <ArrowUpDown
                    className={cn(
                      "h-3.5 w-3.5",
                      sortKey === "createdAt" ? "text-stone-900" : "text-stone-300",
                    )}
                  />
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPending &&
              [0, 1, 2].map((i) => (
                <tr key={i} className="border-b border-stone-100 last:border-0">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-5 animate-pulse rounded bg-stone-200" />
                  </td>
                </tr>
              ))}
            {!isPending &&
              rows.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="font-medium text-stone-900 underline-offset-2 hover:underline"
                    >
                      #{order.id.slice(-5).toUpperCase()}
                    </Link>
                    <p className="mt-0.5 max-w-56 truncate text-xs text-stone-500">
                      {order.lines.map((l) => `${l.itemName} x ${l.quantity}`).join(", ")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-900">{order.customerName}</p>
                    <p className="max-w-48 truncate text-xs text-stone-500">
                      {order.street}, {order.area}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-900">${order.totalPrice}</td>
                  <td className="px-4 py-3 text-stone-500">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-4">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="inline-flex cursor-pointer items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                      {order.status === "pending" && (
                        <Button
                          variant="outline"
                          className="h-auto cursor-pointer gap-1 border-0 p-0 text-sm font-normal text-red-600 hover:bg-transparent hover:text-red-800"
                          onClick={() => setPendingCancel(order)}
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            {!isPending && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">
                  {search ? `No orders match "${search}" on this page.` : "No orders yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-stone-500">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="md"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="md"
              disabled={page >= pageCount}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {pendingCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4">
          <Card className="w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-stone-900">Cancel order?</h2>
            <p className="mt-2 text-sm text-stone-500">
              Order #{pendingCancel.id.slice(-5).toUpperCase()} for {pendingCancel.customerName}
              (${pendingCancel.totalPrice}) will be cancelled. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingCancel(null)}>
                Keep order
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={cancellation.isPending}
                onClick={() => cancellation.mutate(pendingCancel.id)}
              >
                {cancellation.isPending ? "Cancelling..." : "Cancel order"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
