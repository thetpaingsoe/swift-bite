import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { listOrders } from "../api/orders";
import { StatusText, statusLabel } from "../components/OrderStatus";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { cn } from "../lib/cn";

const tabs = ["all", "pending", "cooking", "ready", "dispatched", "cancelled"] as const;
const PAGE_SIZE = 10;

export function Orders() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("all");
  const [page, setPage] = useState(1);

  const { data, isPending, isError } = useQuery({
    queryKey: ["orders", page, tab],
    queryFn: () => listOrders(page, PAGE_SIZE, tab === "all" ? undefined : tab),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const pageCount = data?.meta.pageCount ?? 0;
  const total = data?.meta.total ?? 0;

  function selectTab(t: (typeof tabs)[number]) {
    setTab(t);
    setPage(1);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Orders</h1>
      <p className="mt-1 text-sm text-stone-500">
        Your order history{total > 0 ? ` · ${total} total` : ""}.
      </p>

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

      {isPending && (
        <div className="mt-4 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-stone-200" />
          ))}
        </div>
      )}

      {isError && (
        <p className="mt-6 text-sm text-red-600">Could not load orders.</p>
      )}

      {!isPending && !isError && rows.length === 0 && (
        <p className="mt-6 text-sm text-stone-500">
          {tab === "all" ? (
            <>No orders yet. <Link to="/" className="underline">Browse the menu</Link>.</>
          ) : (
            <>No {statusLabel(tab)} orders.</>
          )}
        </p>
      )}

      {rows.length > 0 && (
        <Card className="mt-4 overflow-hidden">
          {rows.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="flex items-center gap-3 border-b border-stone-100 px-5 py-3 last:border-0 hover:bg-stone-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-900">
                  Order: {order.id.slice(-5).toUpperCase()}
                </p>
                <p className="truncate text-sm text-stone-900">
                  {order.lines.map((line) => `${line.itemName} × ${line.quantity}`).join(", ")}
                </p>
                <p className="truncate text-xs text-stone-400">
                  {new Date(order.createdAt).toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span className="flex-1" />
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-semibold text-stone-900">${order.totalPrice}</span>
                <StatusText status={order.status} />
              </div>
            </Link>
          ))}
        </Card>
      )}

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
    </div>
  );
}
