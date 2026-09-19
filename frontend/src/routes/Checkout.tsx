import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { placeOrder } from "../api/orders";
import { clearCart } from "../store/cart-slice";
import { useAppDispatch, useAppSelector } from "../store/store";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";

const schema = z.object({
  customerName: z.string().min(1, "Name is required"),
  street: z.string().min(1, "Street is required"),
  area: z.string().min(1, "Area is required"),
});

type FormValues = z.infer<typeof schema>;

export function Checkout() {
  const lines = useAppSelector((s) => s.cart.lines);
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { customerName: user?.name ?? "" },
  });

  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  async function onSubmit(values: FormValues) {
    setPlacing(true);
    try {
      const res = await placeOrder({
        customerName: values.customerName,
        street: values.street,
        area: values.area,
        lines: lines.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
        })),
      });
      dispatch(clearCart());
      navigate("/confirmation", { state: { orderIds: [res.orderId] } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Order failed");
    } finally {
      setPlacing(false);
    }
  }

  if (lines.length === 0) {
    return <p className="py-16 text-center text-sm text-stone-500">Your cart is empty.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Checkout</h1>
      <Card className="mt-4 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Input placeholder="Your name" {...register("customerName")} />
            {errors.customerName && (
              <p className="mt-1 text-sm text-red-600">{errors.customerName.message}</p>
            )}
          </div>
          <div>
            <Input placeholder="Street" {...register("street")} />
            {errors.street && (
              <p className="mt-1 text-sm text-red-600">{errors.street.message}</p>
            )}
          </div>
          <div>
            <Input placeholder="Area" {...register("area")} />
            {errors.area && (
              <p className="mt-1 text-sm text-red-600">{errors.area.message}</p>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={placing}>
            {placing ? "Placing order..." : `Place order · $${total}`}
          </Button>
        </form>
      </Card>
    </div>
  );
}
