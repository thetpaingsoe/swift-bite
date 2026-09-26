import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createAddress, listAddresses, type AddressInput } from "../api/addresses";
import { AddressForm } from "../components/AddressForm";

export function ProfileAddressNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({ queryKey: ["addresses"], queryFn: listAddresses });

  const creation = useMutation({
    mutationFn: (input: AddressInput) => createAddress(input),
    onSuccess: () => {
      toast.success("Address saved");
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
        <span className="font-medium text-stone-900">New</span>
      </nav>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-stone-900">
        New address
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        {data?.length ? "Add another place to deliver to." : "Save your first delivery address."}
      </p>
      <div className="mt-8 max-w-md">
        <AddressForm
          saving={creation.isPending}
          submitLabel="Save address"
          onSubmit={(input) => creation.mutate(input)}
        />
      </div>
    </div>
  );
}
