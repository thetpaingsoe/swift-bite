import { Minus, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { setQuantity, type CartLine } from "../store/cart-slice";
import { useAppDispatch } from "../store/store";

export function CartLineRow({ line }: { line: CartLine }) {
  const dispatch = useAppDispatch();

  return (
    <div className="flex items-center gap-3 border-b border-stone-100 py-3 last:border-0">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100">
        {line.imageUrl ? (
          <img
            src={line.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <UtensilsCrossed className="h-5 w-5 text-stone-300" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-stone-900">{line.name}</p>
        <p className="text-sm text-stone-500">${line.price} each</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            dispatch(setQuantity({ menuItemId: line.menuItemId, quantity: line.quantity - 1 }))
          }
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-stone-300 text-stone-700 hover:bg-stone-100"
          aria-label="Decrease quantity"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-6 text-center text-sm font-medium">{line.quantity}</span>
        <button
          onClick={() =>
            dispatch(setQuantity({ menuItemId: line.menuItemId, quantity: line.quantity + 1 }))
          }
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-stone-300 text-stone-700 hover:bg-stone-100"
          aria-label="Increase quantity"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <span className="w-16 text-right text-sm font-semibold text-stone-900">
        ${line.price * line.quantity}
      </span>
      <button
        onClick={() => dispatch(setQuantity({ menuItemId: line.menuItemId, quantity: 0 }))}
        className="cursor-pointer rounded-full p-1.5 text-red-600 hover:text-red-800"
        aria-label={`Remove ${line.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
