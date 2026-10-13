import { apiFetch } from "./client";

const ORDERS_URL = import.meta.env.VITE_ORDERS_URL ?? "/api/orders";

export interface PlaceOrderLine {
  menuItemId: string;
  quantity: number;
}

export interface PlaceOrderInput {
  customerName: string;
  street: string;
  area: string;
  phone: string;
  note?: string;
  lines: PlaceOrderLine[];
}

export function placeOrder(input: PlaceOrderInput) {
  return apiFetch(`${ORDERS_URL}/orders`, {
    method: "POST",
    body: JSON.stringify(input),
  }) as Promise<{ success: boolean; orderId: string }>;
}

export interface OrderLine {
  id: string;
  menuItemId: string;
  itemName: string;
  itemPrice: string;
  quantity: number;
}

export interface OrderEvent {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  customerName: string;
  subtotal: string;
  fee: string;
  tax: string;
  totalPrice: string;
  paymentStatus: string;
  paymentIntentId: string | null;
  street: string;
  area: string;
  phone: string | null;
  note: string | null;
  status: string;
  createdAt: string;
  lines: OrderLine[];
  events?: OrderEvent[];
}

export interface OrderPage {
  data: Order[];
  meta: { total: number; page: number; limit: number; pageCount: number };
}

export function listOrders(page = 1, limit = 10, status?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  return apiFetch(`${ORDERS_URL}/orders?${params}`) as Promise<OrderPage>;
}

export function getOrder(id: string) {
  return apiFetch(`${ORDERS_URL}/orders/${id}`) as Promise<Order>;
}

export function cancelOrder(id: string) {
  return apiFetch(`${ORDERS_URL}/orders/${id}/cancel`, {
    method: "PATCH",
  }) as Promise<Order>;
}
