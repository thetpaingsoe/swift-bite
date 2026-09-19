import { cn } from "../lib/cn";

const steps = ["pending", "cooking", "ready", "dispatched"];

export function statusLabel(status: string) {
  return status === "dispatched" ? "delivered" : status;
}

const dotColors: Record<string, string> = {
  pending: "bg-amber-500",
  cooking: "bg-blue-500",
  ready: "bg-violet-500",
  dispatched: "bg-green-500",
  cancelled: "bg-red-500",
};

const textColors: Record<string, string> = {
  pending: "text-amber-600",
  cooking: "text-blue-600",
  ready: "text-violet-600",
  dispatched: "text-green-600",
  cancelled: "text-red-600",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-1 text-xs font-medium text-white",
        dotColors[status] ?? "bg-stone-500",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function StatusText({ status }: { status: string }) {
  return (
    <span className={cn("text-sm font-bold capitalize", textColors[status] ?? "text-stone-500")}>
      {statusLabel(status)}
    </span>
  );
}

export function StatusTimeline({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-red-500" />
        <span className="text-sm font-medium text-stone-900">Cancelled</span>
      </div>
    );
  }

  const current = steps.indexOf(status);

  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-3">
          <span
            className={cn(
              "h-3 w-3 rounded-full",
              i <= current ? dotColors[step] : "bg-stone-200",
            )}
          />
          <span
            className={cn(
              "text-sm capitalize",
              i <= current ? "font-medium text-stone-900" : "text-stone-400",
            )}
          >
            {statusLabel(step)}
          </span>
        </li>
      ))}
    </ol>
  );
}
