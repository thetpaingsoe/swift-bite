import { X } from "lucide-react";
import { useAppSelector } from "../store/store";
import { CartLineRow } from "./CartLineRow";
import { CheckoutButton } from "./CheckoutButton";

export function CartModal({ onClose, onCheckout }: { onClose: () => void; onCheckout: () => void }) {
  const lines = useAppSelector((s) => s.cart.lines);

  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 px-4 pb-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="font-semibold text-stone-900">Your cart</h2>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-full p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto px-5 py-2">
          {lines.map((line) => (
            <CartLineRow key={line.menuItemId} line={line} />
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 px-5 py-4">
          <span className="font-semibold text-stone-900">Total: ${total}</span>
          <CheckoutButton onClick={onCheckout} />
        </div>
      </div>
    </div>
  );
}
