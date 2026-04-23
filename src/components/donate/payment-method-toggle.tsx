"use client";

import { cn } from "@/lib/utils";

export type PaymentMethod = "crypto" | "paypal";

interface PaymentMethodToggleProps {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
}

const methods: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: "crypto", label: "Crypto", icon: "₿" },
  { id: "paypal", label: "PayPal", icon: "P" },
];

export function PaymentMethodToggle({
  value,
  onChange,
}: PaymentMethodToggleProps) {
  return (
    <div className="inline-flex rounded-xl bg-muted/60 p-1 ring-1 ring-border/40">
      {methods.map((method) => (
        <button
          key={method.id}
          type="button"
          onClick={() => onChange(method.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
            value === method.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
          )}
        >
          <span className="text-base leading-none">{method.icon}</span>
          {method.label}
        </button>
      ))}
    </div>
  );
}