import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listOrders } from "../api/orders";
import { StatusBadge } from "../components/OrderStatus";
import { Card } from "../components/ui/card";

export function Orders() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: listOrders,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Orders</h1>
      <p className="mt-1 text-sm text-stone-500">Your order history.</p>

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

      {data?.length === 0 && (
        <p className="mt-6 text-sm text-stone-500">
          No orders yet. <Link to="/" className="underline">Browse the menu</Link>.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {data?.map((order) => (
          <Link key={order.id} to={`/orders/${order.id}`} className="block">
            <Card className="flex items-center justify-between p-4 hover:border-stone-300">
              <div>
                <p className="font-medium text-stone-900">
                  {order.itemName} × {order.quantity}
                </p>
                <p className="font-mono text-xs text-stone-400">{order.id}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-stone-900">${order.totalPrice}</span>
                <StatusBadge status={order.status} />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
