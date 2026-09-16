import { Link, useNavigate } from "react-router-dom";
import { setQuantity } from "../store/cart-slice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function Cart() {
  const lines = useAppSelector((s) => s.cart.lines);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <h1 className="text-2xl font-semibold text-stone-900">Your cart is empty</h1>
        <p className="text-sm text-stone-500">Add something tasty from the menu.</p>
        <Link to="/">
          <Button>Browse menu</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Cart</h1>
      <div className="mt-4 space-y-3">
        {lines.map((line) => (
          <Card key={line.menuItemId} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-stone-900">{line.name}</p>
              <p className="text-sm text-stone-500">
                ${line.price} each
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 text-stone-700"
                  onClick={() =>
                    dispatch(
                      setQuantity({ menuItemId: line.menuItemId, quantity: line.quantity - 1 }),
                    )
                  }
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-medium">{line.quantity}</span>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 text-stone-700"
                  onClick={() =>
                    dispatch(
                      setQuantity({ menuItemId: line.menuItemId, quantity: line.quantity + 1 }),
                    )
                  }
                >
                  +
                </button>
              </div>
              <span className="w-16 text-right font-semibold text-stone-900">
                ${line.price * line.quantity}
              </span>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-lg font-semibold text-stone-900">Total: ${total}</p>
        <Button size="lg" onClick={() => navigate("/checkout")}>
          Checkout
        </Button>
      </div>
    </div>
  );
}
