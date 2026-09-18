import { cn } from "../lib/cn";

const styles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  cooking: "bg-blue-100 text-blue-800",
  dispatched: "bg-violet-100 text-violet-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-1 text-xs font-medium",
        styles[status] ?? "bg-stone-200 text-stone-700",
      )}
    >
      {status}
    </span>
  );
}
