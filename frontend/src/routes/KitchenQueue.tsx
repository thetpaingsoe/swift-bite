import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, X } from "lucide-react";
import { toast } from "sonner";
import {
  acceptTicket,
  completeTicket,
  listTickets,
  rejectTicket,
  type Ticket,
} from "../api/kitchen";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

function minutesAgo(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  return `${mins} min ago`;
}

function TicketCard({
  ticket,
  busy,
  onAccept,
  onComplete,
  onReject,
}: {
  ticket: Ticket;
  busy: boolean;
  onAccept: () => void;
  onComplete: () => void;
  onReject: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-stone-900">
          #{ticket.orderId.slice(-5).toUpperCase()}
        </span>
        <span className="flex items-center gap-1 text-xs text-stone-400">
          <Clock className="h-3.5 w-3.5" />
          {minutesAgo(ticket.createdAt)}
        </span>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {ticket.items.map((line, i) => (
          <li key={i} className="flex justify-between text-stone-800">
            <span>{line.itemName}</span>
            <span className="font-medium text-stone-500">× {line.quantity}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-stone-400">{ticket.area}</p>
      {ticket.phone && (
        <a
          href={`tel:${ticket.phone}`}
          className="mt-1 block text-sm font-medium text-stone-900 hover:underline"
        >
          {ticket.phone}
        </a>
      )}
      {ticket.note && (
        <p className="mt-1 text-sm text-amber-700">{ticket.note}</p>
      )}
      <div className="mt-4 flex gap-2">
        {ticket.status === "received" && (
          <Button
            className="flex-1"
            disabled={busy}
            onClick={onAccept}
          >
            <Check className="h-4 w-4" />
            Accept
          </Button>
        )}
        {ticket.status === "cooking" && (
          <Button
            className="flex-1"
            disabled={busy}
            onClick={onComplete}
          >
            <Check className="h-4 w-4" />
            Complete
          </Button>
        )}
        {(ticket.status === "received" || ticket.status === "cooking") && (
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            disabled={busy}
            onClick={onReject}
          >
            <X className="h-4 w-4" />
            Reject
          </Button>
        )}
      </div>
    </Card>
  );
}

export function KitchenQueue() {
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => listTickets(),
    refetchInterval: 4000,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  }

  const accept = useMutation({
    mutationFn: acceptTicket,
    onSuccess: () => {
      toast.success("Ticket accepted");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const complete = useMutation({
    mutationFn: completeTicket,
    onSuccess: () => {
      toast.success("Ticket completed");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const reject = useMutation({
    mutationFn: rejectTicket,
    onSuccess: () => {
      toast.success("Ticket rejected");
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const tickets = data ?? [];
  const received = tickets.filter((t) => t.status === "received");
  const cooking = tickets.filter((t) => t.status === "cooking");
  const ready = tickets.filter((t) => t.status === "ready");

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Kitchen queue
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Accept new orders to start cooking, complete them to send to a rider.
      </p>

      {isError && (
        <p className="mt-4 text-sm text-red-600">Could not load the queue.</p>
      )}

      {isPending ? (
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-stone-200" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <h2 className="font-semibold text-stone-900">New</h2>
              <span className="rounded-full bg-stone-200 px-2 text-xs font-semibold text-stone-600">
                {received.length}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {received.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  busy={accept.isPending && accept.variables === ticket.id}
                  onAccept={() => accept.mutate(ticket.id)}
                  onComplete={() => complete.mutate(ticket.id)}
                  onReject={() => reject.mutate(ticket.id)}
                />
              ))}
              {received.length === 0 && (
                <p className="rounded-2xl border border-dashed border-stone-200 py-8 text-center text-sm text-stone-400">
                  Nothing here
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <h2 className="font-semibold text-stone-900">Cooking</h2>
              <span className="rounded-full bg-stone-200 px-2 text-xs font-semibold text-stone-600">
                {cooking.length}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {cooking.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  busy={complete.isPending && complete.variables === ticket.id}
                  onAccept={() => accept.mutate(ticket.id)}
                  onComplete={() => complete.mutate(ticket.id)}
                  onReject={() => reject.mutate(ticket.id)}
                />
              ))}
              {cooking.length === 0 && (
                <p className="rounded-2xl border border-dashed border-stone-200 py-8 text-center text-sm text-stone-400">
                  Nothing here
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <h2 className="font-semibold text-stone-900">Ready</h2>
              <span className="rounded-full bg-stone-200 px-2 text-xs font-semibold text-stone-600">
                {ready.length}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {ready.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  busy={false}
                  onAccept={() => accept.mutate(ticket.id)}
                  onComplete={() => complete.mutate(ticket.id)}
                  onReject={() => reject.mutate(ticket.id)}
                />
              ))}
              {ready.length === 0 && (
                <p className="rounded-2xl border border-dashed border-stone-200 py-8 text-center text-sm text-stone-400">
                  Nothing here
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
