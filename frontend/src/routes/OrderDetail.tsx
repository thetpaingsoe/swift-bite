import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getOrder } from "../api/orders";
import { StatusBadge } from "../components/StatusBadge";
import { Card } from "../components/ui/card";
import { cn } from "../lib/cn";

const steps = ["pending", "cooking", "dispatched", "delivered"];
const terminal = ["delivered", "cancelled"];

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, isError } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(id!),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && terminal.includes(status) ? false : 3000;
    },
  });

  if (isPending) return <div className="mt-4 h-40 animate-pulse rounded-2xl bg-stone-200" />;
  if (isError || !data)
    return <p className="mt-6 text-sm text-red-600">Order not found.</p>;

  const currentIndex = steps.indexOf(data.status);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          {data.itemName} × {data.quantity}
        </h1>
        <StatusBadge status={data.status} />
      </div>

      <Card className="mt-4 p-6">
        <ol className="space-y-3">
          {steps.map((step, index) => {
            const done = currentIndex >= 0 && index <= currentIndex;
            return (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    done ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-500",
                  )}
                >
                  {index + 1}
                </span>
                <span className={done ? "text-stone-900" : "text-stone-400"}>{step}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="mt-4 p-6 text-sm text-stone-600">
        <p>
          {data.street}, {data.area}
        </p>
        <p className="mt-1">Total: ${data.totalPrice}</p>
        <p className="mt-1 font-mono text-xs text-stone-400">{data.id}</p>
      </Card>
    </div>
  );
}
