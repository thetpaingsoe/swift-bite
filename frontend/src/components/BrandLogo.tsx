import { ChefHat } from "lucide-react";

export function BrandLogo({ suffix }: { suffix?: string }) {
  return (
    <span className="flex items-center gap-2 font-bold tracking-tight text-stone-900">
      <ChefHat className="h-5 w-5 text-primary" strokeWidth={2.5} />
      <span>
        Swift<span className="text-primary">Bite</span>
        {suffix ? ` ${suffix}` : ""}
      </span>
    </span>
  );
}
