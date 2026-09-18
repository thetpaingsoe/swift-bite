import { apiFetch } from "./client";

const ORDERS_URL = import.meta.env.VITE_ORDERS_URL ?? "/api/orders";

export interface PlaceOrderInput {
  customerName: string;
  menuItemId: string;
  quantity: number;
  street: string;
  area: string;
}

export function placeOrder(input: PlaceOrderInput) {
  return apiFetch(`${ORDERS_URL}/orders`, {
    method: "POST",
    body: JSON.stringify(input),
  }) as Promise<{ success: boolean; orderId: string }>;
}

export interface Order {
  id: string;
  customerName: string;
  menuItemId: string;
  itemName: string;
  itemPrice: string;
  quantity: number;
  totalPrice: string;
  street: string;
  area: string;
  status: string;
  createdAt: string;
}

export function listOrders() {
  return apiFetch(`${ORDERS_URL}/orders`) as Promise<Order[]>;
}

export function getOrder(id: string) {
  return apiFetch(`${ORDERS_URL}/orders/${id}`) as Promise<Order>;
}
