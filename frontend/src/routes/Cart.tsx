import { Link, useNavigate } from "react-router-dom";
import { useAppSelector } from "../store/store";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { CartLineRow } from "../components/CartLineRow";

export function Cart() {
  const lines = useAppSelector((s) => s.cart.lines);
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
      <Card className="mt-4 px-5 py-2">
        {lines.map((line) => (
          <CartLineRow key={line.menuItemId} line={line} />
        ))}
      </Card>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-lg font-semibold text-stone-900">Total: ${total}</p>
        <Button size="lg" onClick={() => navigate("/checkout")}>
          Checkout
        </Button>
      </div>
    </div>
  );
}
