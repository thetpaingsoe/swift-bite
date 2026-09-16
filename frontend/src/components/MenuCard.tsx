import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import type { MenuItem } from "../api/items";
import { addLine } from "../store/cart-slice";
import { useAppDispatch } from "../store/store";
import { Button } from "./ui/button";
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
        <Button
          className="mt-3 w-full"
          disabled={!item.available}
          onClick={add}
        >
          {item.available ? "Add to cart" : "Unavailable"}
        </Button>
      </div>
    </Card>
  );
}
