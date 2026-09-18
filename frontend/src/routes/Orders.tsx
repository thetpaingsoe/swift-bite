import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listOrders } from "../api/orders";
import { StatusBadge } from "../components/StatusBadge";
import { Card } from "../components/ui/card";

export function Orders() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: listOrders,
  });

  if (isPending) {
    return (
      <div className="mt-4 space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-stone-200" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="mt-6 text-sm text-red-600">
        Could not load orders. Check that orders-service is running.
      </p>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <h1 className="text-2xl font-semibold text-stone-900">No orders yet</h1>
        <p className="text-sm text-stone-500">Your placed orders will show up here.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Orders</h1>
      <div className="mt-4 space-y-3">
        {data.map((order) => (
          <Link key={order.id} to={`/orders/${order.id}`}>
            <Card className="flex items-center justify-between p-4 hover:border-stone-300">
              <div>
                <p className="font-medium text-stone-900">
                  {order.itemName} × {order.quantity}
                </p>
                <p className="text-sm text-stone-500">${order.totalPrice}</p>
              </div>
              <StatusBadge status={order.status} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
