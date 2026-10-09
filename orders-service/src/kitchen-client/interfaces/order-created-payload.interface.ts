export interface OrderCreatedLine {
  menuItemId: string;
  itemName: string;
  quantity: number;
}

export interface OrderCreatedPayload {
  orderId: string;
  customerName: string;
  lines: OrderCreatedLine[];
  street: string;
  area: string;
  phone: string | null;
  note: string | null;
  correlationId: string;
}
