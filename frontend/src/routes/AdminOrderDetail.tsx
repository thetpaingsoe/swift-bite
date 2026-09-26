import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { cancelOrder, getOrder } from "../api/orders";
import { StatusBadge, StatusTimeline } from "../components/OrderStatus";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);

  const { data: order, isPending, isError } = useQuery({
    queryKey: ["orders", id],
    queryFn: () => getOrder(id!),
  });

  async function onCancel() {
    if (!id) return;
    setCancelling(true);
    try {
      await cancelOrder(id);
      toast.success("Order cancelled");
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  }

  if (isPending)
    return (
      <div>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/admin/orders" className="cursor-pointer text-stone-500 hover:text-stone-900">
            Orders
          </Link>
          <span className="text-stone-300">/</span>
          <span className="font-medium text-stone-900">Order detail</span>
        </nav>
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-stone-200" />
      </div>
    );
  if (isError || !order)
    return (
      <div>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/admin/orders" className="cursor-pointer text-stone-500 hover:text-stone-900">
            Orders
          </Link>
          <span className="text-stone-300">/</span>
          <span className="font-medium text-stone-900">Order detail</span>
        </nav>
        <p className="mt-8 text-sm text-red-600">Could not load this order.</p>
      </div>
    );

  const itemCount = order.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/admin/orders" className="cursor-pointer text-stone-500 hover:text-stone-900">
          Orders
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-900">Order detail</span>
      </nav>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          #{order.id.slice(-5).toUpperCase()} · {order.customerName}
        </h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="mt-1 text-sm text-stone-500">
        {itemCount} {itemCount === 1 ? "item" : "items"} · ${order.totalPrice}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-medium text-stone-900">Items</h2>
          <ul className="mt-4 space-y-3">
            {order.lines.map((line) => (
              <li key={line.id} className="flex items-center justify-between text-sm">
                <span className="text-stone-900">
                  {line.itemName} <span className="text-stone-400">x {line.quantity}</span>
                </span>
                <span className="font-medium text-stone-900">
                  ${Number(line.itemPrice) * line.quantity}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="font-medium text-stone-900">Progress</h2>
          <div className="mt-4">
            <StatusTimeline status={order.status} />
          </div>
        </Card>
        <Card className="p-6 md:col-span-2">
          <h2 className="font-medium text-stone-900">Details</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Customer</dt>
              <dd className="text-stone-900">{order.customerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Total</dt>
              <dd className="font-medium text-stone-900">${order.totalPrice}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Deliver to</dt>
              <dd className="text-stone-900">
                {order.street}, {order.area}
              </dd>
            </div>
            {order.phone && (
              <div className="flex justify-between">
                <dt className="text-stone-500">Phone</dt>
                <dd className="text-stone-900">{order.phone}</dd>
              </div>
            )}
            {order.note && (
              <div className="flex justify-between">
                <dt className="text-stone-500">Note</dt>
                <dd className="text-stone-900">{order.note}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-stone-500">Placed</dt>
              <dd className="text-stone-900">
                {new Date(order.createdAt).toLocaleString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Order ID</dt>
              <dd className="truncate font-mono text-xs text-stone-500">{order.id}</dd>
            </div>
          </dl>
          {order.status === "pending" && (
            <Button
              variant="outline"
              className="mt-6 w-full border-red-300 text-red-600 hover:bg-red-50"
              disabled={cancelling}
              onClick={onCancel}
            >
              {cancelling ? "Cancelling..." : "Cancel order"}
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
