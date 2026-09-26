import { apiFetch } from "./client";

const KITCHEN_URL = import.meta.env.VITE_KITCHEN_URL ?? "/api/kitchen";

export interface TicketLine {
  menuItemId?: string;
  itemName: string;
  quantity: number;
}

export interface Ticket {
  id: string;
  orderId: string;
  customerName: string;
  items: TicketLine[];
  street: string;
  area: string;
  phone: string | null;
  note: string | null;
  status: "received" | "cooking" | "ready" | "rejected";
  correlationId: string | null;
  createdAt: string;
}

export function listTickets(status?: string) {
  const query = status ? `?status=${status}` : "";
  return apiFetch(`${KITCHEN_URL}/tickets${query}`) as Promise<Ticket[]>;
}

export function acceptTicket(id: string) {
  return apiFetch(`${KITCHEN_URL}/tickets/${id}/accept`, {
    method: "PATCH",
  }) as Promise<Ticket>;
}

export function completeTicket(id: string) {
  return apiFetch(`${KITCHEN_URL}/tickets/${id}/complete`, {
    method: "PATCH",
  }) as Promise<Ticket>;
}

export function rejectTicket(id: string) {
  return apiFetch(`${KITCHEN_URL}/tickets/${id}/reject`, {
    method: "PATCH",
  }) as Promise<Ticket>;
}
