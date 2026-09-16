import { Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function Confirmation() {
  const location = useLocation();
  const orderIds = ((location.state as { orderIds?: string[] } | null)?.orderIds ?? []);

  return (
    <div className="flex flex-col items-center py-16">
      <h1 className="text-2xl font-semibold text-stone-900">Order confirmed</h1>
      <p className="mt-1 text-sm text-stone-500">The kitchen is on it.</p>
      <Card className="mt-6 w-full max-w-sm p-6">
        {orderIds.map((id) => (
          <p key={id} className="truncate font-mono text-sm text-stone-700">
            {id}
          </p>
        ))}
      </Card>
      <Link to="/" className="mt-6">
        <Button variant="outline">Back to menu</Button>
      </Link>
    </div>
  );
}
