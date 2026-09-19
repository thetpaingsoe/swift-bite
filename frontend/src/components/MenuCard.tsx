import { useState } from "react";
import { Plus, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import type { MenuItem } from "../api/items";
import { addLine } from "../store/cart-slice";
import { useAppDispatch } from "../store/store";
import { Card } from "./ui/card";

export function MenuCard({ item }: { item: MenuItem }) {
  const dispatch = useAppDispatch();
  const [imgOk, setImgOk] = useState(true);

  function add() {
    dispatch(
      addLine({
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl,
      }),
    );
    toast.success(`${item.name} added to cart`);
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex h-36 items-center justify-center bg-stone-100">
        {item.imageUrl && imgOk ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
            onError={() => setImgOk(false)}
          />
        ) : (
          <UtensilsCrossed className="h-10 w-10 text-stone-300" />
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-stone-900">{item.name}</h3>
          <span className="shrink-0 font-semibold text-stone-900">${item.price}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-stone-500">{item.description}</p>
        <div className="mt-3 flex justify-end">
          <button
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dark disabled:cursor-default disabled:opacity-50"
            disabled={!item.available}
            onClick={add}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
              <Plus className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            {item.available ? "Add to Cart" : "Unavailable"}
          </button>
        </div>
      </div>
    </Card>
  );
}
