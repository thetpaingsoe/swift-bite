import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  listAddresses,
  updateAddress,
  type AddressInput,
} from "../api/addresses";
import { AddressForm } from "../components/AddressForm";

export function ProfileAddressEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["addresses"],
    queryFn: listAddresses,
  });

  const address = id ? data?.find((a) => a.id === id) : undefined;

  const saveMutation = useMutation({
    mutationFn: (input: AddressInput) => {
      if (!id) throw new Error("Missing address id");
      return updateAddress(id, input);
    },
    onSuccess: () => {
      toast.success("Address updated");
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      navigate("/profile/addresses");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Save failed");
    },
  });

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/profile" className="cursor-pointer text-stone-500 hover:text-stone-900">
          Profile
        </Link>
        <span className="text-stone-300">/</span>
        <Link
          to="/profile/addresses"
          className="cursor-pointer text-stone-500 hover:text-stone-900"
        >
          Addresses
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-900">Edit</span>
      </nav>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-stone-900">
        Edit address
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Past orders keep their snapshot. Only new orders use changes.
      </p>
      {isPending ? (
        <div className="mt-8 h-64 max-w-md animate-pulse rounded-2xl bg-stone-200" />
      ) : !address ? (
        <p className="mt-8 text-sm text-red-600">Address not found.</p>
      ) : (
        <div className="mt-8 max-w-md">
          <AddressForm
            key={address.id}
            initial={{
              label: address.label,
              street: address.street,
              area: address.area,
            }}
            saving={saveMutation.isPending}
            submitLabel="Save changes"
            onSubmit={(input) => saveMutation.mutate(input)}
          />
        </div>
      )}
    </div>
  );
}
