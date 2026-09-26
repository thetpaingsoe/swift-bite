import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import {
  createAddress,
  listAddresses,
  updateAddress,
  type Address,
  type AddressInput,
} from "../api/addresses";
import { updateProfile } from "../api/auth";
import { placeOrder } from "../api/orders";
import { AddressForm } from "../components/AddressForm";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { cn } from "../lib/cn";
import { clearCart } from "../store/cart-slice";
import { updateUser } from "../store/auth-slice";
import { useAppDispatch, useAppSelector } from "../store/store";

const schema = z.object({
  note: z.string().max(255).optional(),
});

type FormValues = z.infer<typeof schema>;

export function Checkout() {
  const lines = useAppSelector((s) => s.cart.lines);
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [placing, setPlacing] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { note: "" },
  });

  const [contact, setContact] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
  });
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);
  if (user && user.id !== syncedUserId) {
    setSyncedUserId(user.id);
    setContact({ name: user.name, phone: user.phone ?? "" });
  }

  const addressesQuery = useQuery({
    queryKey: ["addresses"],
    queryFn: listAddresses,
  });

  const addresses = addressesQuery.data ?? [];
  const selected =
    pickedId != null
      ? (addresses.find((a) => a.id === pickedId) ?? null)
      : (addresses[0] ?? null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["addresses"] });
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setAddingNew(false);
  }

  function pick(id: string) {
    setPickedId(id);
    closeModal();
  }

  const creation = useMutation({
    mutationFn: (input: AddressInput) => createAddress(input),
    onSuccess: (created) => {
      toast.success("Address saved");
      invalidate();
      pick(created.id);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Save failed");
    },
  });

  const edition = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AddressInput }) =>
      updateAddress(id, input),
    onSuccess: () => {
      toast.success("Address updated");
      invalidate();
      setEditingId(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Save failed");
    },
  });

  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  async function onSubmit(values: FormValues) {
    if (!selected) {
      setModalOpen(true);
      return;
    }
    setPlacing(true);
    try {
      const res = await placeOrder({
        customerName: contact.name.trim(),
        street: selected.street,
        area: selected.area,
        phone: contact.phone.trim(),
        note: values.note?.trim() ? values.note.trim() : undefined,
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
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-stone-900">Contact</h2>
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="inline-flex cursor-pointer items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-stone-500">Name</span>
            <span className="truncate text-stone-900">{contact.name || "–"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-stone-500">Email</span>
            <span className="truncate text-stone-900">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-stone-500">Phone</span>
            <span className="truncate text-stone-900">{contact.phone || "–"}</span>
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-stone-900">Delivery address</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(true)}>
            <MapPin className="h-4 w-4" />
            {selected ? "Change" : "Select"}
          </Button>
        </div>
        {addressesQuery.isPending ? (
          <div className="mt-4 h-12 animate-pulse rounded-xl bg-stone-200" />
        ) : selected ? (
          <div className="mt-3 text-sm">
            <p className="font-semibold text-stone-900">{selected.label}</p>
            <p className="mt-0.5 text-stone-600">
              {selected.street}, {selected.area}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            {addressesQuery.isError
              ? "Could not load addresses."
              : "No saved addresses yet."}{" "}
            Pick one to deliver to.
          </p>
        )}
      </Card>

      <Card className="mt-4 p-6">
        <label htmlFor="checkout-note" className="font-medium text-stone-900">
          Order note
        </label>
        <p className="mt-1 text-sm text-stone-500">Optional, goes to the kitchen.</p>
        <Input
          id="checkout-note"
          placeholder="e.g. Extra spicy, no onions"
          className="mt-3"
          {...register("note")}
        />
        {errors.note && (
          <p className="mt-1 text-sm text-red-600">{errors.note.message}</p>
        )}
      </Card>

      <Button
        type="button"
        size="lg"
        className="mt-6 w-full"
        disabled={placing || !selected || !contact.phone.trim()}
        onClick={() => {
          void handleSubmit(onSubmit)();
        }}
      >
        {placing ? "Placing order..." : `Place order · $${total}`}
      </Button>

      {contactOpen && (
        <ContactModal
          initialName={contact.name}
          initialPhone={contact.phone}
          onClose={() => setContactOpen(false)}
          onSave={async (name, phone) => {
            const res = await updateProfile(name, phone);
            dispatch(updateUser({ name: res.name, phone: res.phone }));
            setContact({ name: res.name, phone: res.phone ?? "" });
            setContactOpen(false);
          }}
        />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4">
          <Card className="max-h-[85vh] w-full max-w-md overflow-y-auto p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900">Choose address</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={closeModal}
                className="cursor-pointer text-stone-400 hover:text-stone-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {addressesQuery.isPending ? (
              <div className="mt-4 space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-stone-200" />
                ))}
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {addresses.map((address: Address) => {
                  const active = address.id === selected?.id;
                  const editing = address.id === editingId;
                  return (
                    <div
                      key={address.id}
                      className={cn(
                        "rounded-xl border p-4",
                        active ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-200",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          aria-label={`Deliver to ${address.label}`}
                          onClick={() => pick(address.id)}
                          className={cn(
                            "mt-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2",
                            active ? "border-stone-900" : "border-stone-300",
                          )}
                        >
                          {active && (
                            <span className="h-2.5 w-2.5 rounded-full bg-stone-900" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => pick(address.id)}
                          className="min-w-0 flex-1 cursor-pointer text-left"
                        >
                          <p className="font-semibold text-stone-900">{address.label}</p>
                          <p className="mt-0.5 truncate text-sm text-stone-600">
                            {address.street}, {address.area}
                          </p>
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto shrink-0 cursor-pointer gap-1 border-0 p-0 text-sm font-normal text-stone-600 hover:bg-transparent hover:text-stone-900"
                          onClick={() => {
                            setEditingId(editing ? null : address.id);
                            setAddingNew(false);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                      </div>
                      {editing && (
                        <div className="mt-4 border-t border-stone-100 pt-4">
                          <AddressForm
                            key={address.id}
                            initial={{
                              label: address.label,
                              street: address.street,
                              area: address.area,
                            }}
                            saving={edition.isPending}
                            submitLabel="Save changes"
                            onSubmit={(input) =>
                              edition.mutate({ id: address.id, input })
                            }
                            onCancel={() => setEditingId(null)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {addresses.length === 0 && !addingNew && (
                  <p className="py-4 text-center text-sm text-stone-500">
                    No saved addresses yet.
                  </p>
                )}
              </div>
            )}

            {addingNew ? (
              <div className="mt-4 border-t border-stone-100 pt-4">
                <h3 className="font-medium text-stone-900">New address</h3>
                <div className="mt-3">
                  <AddressForm
                    saving={creation.isPending}
                    submitLabel="Save address"
                    onSubmit={(input) => creation.mutate(input)}
                    onCancel={() => setAddingNew(false)}
                  />
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full"
                onClick={() => {
                  setAddingNew(true);
                  setEditingId(null);
                }}
              >
                <Plus className="h-4 w-4" />
                Add a new address
              </Button>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

const contactSchema = z.object({
  customerName: z.string().min(1, "Name is required"),
  phone: z.string().min(6, "Phone needs at least 6 characters").max(30),
});

function ContactModal({
  initialName,
  initialPhone,
  onClose,
  onSave,
}: {
  initialName: string;
  initialPhone: string;
  onClose: () => void;
  onSave: (name: string, phone: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { customerName: initialName, phone: initialPhone },
  });

  async function submit(values: z.infer<typeof contactSchema>) {
    setSaving(true);
    try {
      await onSave(values.customerName.trim(), values.phone.trim());
      toast.success("Contact updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">Edit contact</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="cursor-pointer text-stone-400 hover:text-stone-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(submit)} className="mt-4 space-y-4">
          <div>
            <label htmlFor="contact-name" className="mb-2 block text-sm font-medium text-stone-900">
              Name
            </label>
            <Input id="contact-name" autoComplete="name" {...field("customerName")} />
            {errors.customerName && (
              <p className="mt-1 text-sm text-red-600">{errors.customerName.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="contact-phone" className="mb-2 block text-sm font-medium text-stone-900">
              Phone
            </label>
            <Input id="contact-phone" autoComplete="tel" {...field("phone")} />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
