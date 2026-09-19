import { ArrowRight } from "lucide-react";

export function CheckoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
    >
      Checkout
      <ArrowRight className="h-4 w-4" strokeWidth={3} />
    </button>
  );
}
