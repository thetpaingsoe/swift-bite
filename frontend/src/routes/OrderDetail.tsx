import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { cancelOrder, getOrder } from "../api/orders";
import { StatusBadge, StatusTimeline } from "../components/OrderStatus";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

const terminal = ["dispatched", "cancelled"];

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);

  const { data: order, isPending, isError } = useQuery({
    queryKey: ["orders", id],
    queryFn: () => getOrder(id!),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && terminal.includes(status) ? false : 3000;
    },
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

  if (isPending) return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-stone-200" />;
  if (isError || !order)
    return <p className="mt-6 text-sm text-red-600">Could not load this order.</p>;

  return (
    <div>
      <Link to="/orders" className="text-sm text-stone-500 underline">
        Back to orders
      </Link>
      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          {order.itemName} × {order.quantity}
        </h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-medium text-stone-900">Progress</h2>
          <div className="mt-4">
            <StatusTimeline status={order.status} />
          </div>
          {!terminal.includes(order.status) && (
            <p className="mt-4 text-xs text-stone-400">Updating live…</p>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="font-medium text-stone-900">Details</h2>
          <dl className="mt-4 space-y-2 text-sm">
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
