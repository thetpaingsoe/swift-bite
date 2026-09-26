import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  deleteAddress,
  listAddresses,
  type Address,
} from "../api/addresses";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function ProfileAddresses() {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<Address | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["addresses"],
    queryFn: listAddresses,
  });

  const deletion = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => {
      toast.success("Address deleted");
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setPendingDelete(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    },
  });

  const rows = data ?? [];

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/profile" className="cursor-pointer text-stone-500 hover:text-stone-900">
          Profile
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-900">Addresses</span>
      </nav>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Addresses
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {rows.length} {rows.length === 1 ? "address" : "addresses"} saved
          </p>
        </div>
        <Link to="/profile/addresses/new">
          <Button>
            <Plus className="h-4 w-4" />
            Add address
          </Button>
        </Link>
      </div>

      {isError && (
        <p className="mt-4 text-sm text-red-600">Could not load addresses.</p>
      )}

      {isPending ? (
        <div className="mt-4 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-200" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-stone-500">
          No saved addresses yet. Add one to speed up checkout.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((address) => (
            <Card key={address.id} className="p-5">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900">{address.label}</p>
                  <p className="mt-0.5 text-sm text-stone-600">
                    {address.street}, {address.area}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <Link
                    to={`/profile/addresses/${address.id}/edit`}
                    className="inline-flex cursor-pointer items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Link>
                  <Button
                    variant="outline"
                    className="h-auto cursor-pointer gap-1 border-0 p-0 text-sm font-normal text-red-600 hover:bg-transparent hover:text-red-800"
                    onClick={() => setPendingDelete(address)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 px-4">
          <Card className="w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-stone-900">Delete address?</h2>
            <p className="mt-2 text-sm text-stone-500">
              “{pendingDelete.label}” will be removed. Past orders keep their
              snapshot. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={deletion.isPending}
                onClick={() => deletion.mutate(pendingDelete.id)}
              >
                {deletion.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
