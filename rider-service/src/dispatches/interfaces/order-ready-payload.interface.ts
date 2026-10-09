import type { DispatchLine } from './dispatch-line.interface';

export interface OrderReadyPayload {
  orderId: string;
  customerName: string;
  lines: DispatchLine[];
  street: string;
  area: string;
  phone?: string | null;
  note?: string | null;
  correlationId?: string;
}
