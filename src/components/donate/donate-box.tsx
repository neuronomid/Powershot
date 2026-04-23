"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Loader2, Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PaymentMethodToggle, type PaymentMethod } from "./payment-method-toggle";
import { CryptoPaymentDialog } from "./crypto-payment-dialog";

const PRESET_AMOUNTS = [5, 10, 25, 50] as const;

const POPULAR_CRYPTOS = [
  { value: "btc", label: "BTC", name: "Bitcoin" },
  { value: "eth", label: "ETH", name: "Ethereum" },
  { value: "usdttrc20", label: "USDT", name: "Tether (TRC20)" },
  { value: "usdc", label: "USDC", name: "USD Coin" },
  { value: "ltc", label: "LTC", name: "Litecoin" },
  { value: "sol", label: "SOL", name: "Solana" },
] as const;

interface DonateBoxProps {
  compact?: boolean;
}

type PaymentData = {
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  priceAmount: number;
  priceCurrency: string;
  expirationDate?: string;
};

export function DonateBox({ compact = false }: DonateBoxProps) {
  const [method, setMethod] = useState<PaymentMethod>("crypto");
  const [amount, setAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedCrypto, setSelectedCrypto] = useState("btc");
  const [estimate, setEstimate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payment, setPayment] = useState<PaymentData | null>(null);

  const paypalUrl = process.env.NEXT_PUBLIC_PAYPAL_DONATE_URL ?? "";

  useEffect(() => {
    fetch("/api/donate/currencies")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.currencies)) setCurrencies(data.currencies);
      })
      .catch(() => {});
  }, []);

  const activeAmount =
    customAmount && Number(customAmount) > 0 ? Number(customAmount) : amount;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (method !== "crypto") return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(
        `/api/donate/estimate?amount=${activeAmount}&currencyFrom=usd&currencyTo=${selectedCrypto}`,
        { signal: controller.signal },
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.estimate?.pay_amount) {
            setEstimate(data.estimate.pay_amount);
          } else {
            setEstimate(null);
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") setEstimate(null);
        });
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [activeAmount, selectedCrypto, method]);

  const handleDonate = useCallback(async () => {
    if (method === "paypal") {
      window.open(paypalUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/donate/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceAmount: activeAmount,
          priceCurrency: "usd",
          payCurrency: selectedCrypto,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create payment");
      }

      setPayment({
        paymentId: data.payment.payment_id,
        payAddress: data.payment.pay_address,
        payAmount: data.payment.pay_amount,
        payCurrency: data.payment.pay_currency,
        priceAmount: data.payment.price_amount,
        priceCurrency: data.payment.price_currency,
        expirationDate: data.payment.expiration_estimate_date,
      });
      setDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [method, paypalUrl, activeAmount, selectedCrypto]);

  return (
    <>
      <div
        className={
          compact
            ? "rounded-2xl bg-card/60 backdrop-blur-sm ring-1 ring-border/40 p-4 sm:p-6"
            : "rounded-2xl bg-card/60 backdrop-blur-sm ring-1 ring-border/40 p-5 sm:p-8"
        }
      >
        <div className="flex items-center gap-2 mb-4">
          <Heart className="size-5 text-primary fill-primary" />
          <h3
            className={
              compact
                ? "font-heading text-lg font-bold text-foreground"
                : "font-heading text-xl font-bold text-foreground"
            }
          >
            Support Powershot
          </h3>
        </div>

        {!compact && (
          <p className="text-sm text-muted-foreground mb-5">
            Powershot is free and open source. If you find it useful, consider
            making a donation to help cover server costs and development.
          </p>
        )}

        <div className="flex justify-center mb-5">
          <PaymentMethodToggle value={method} onChange={setMethod} />
        </div>

        {method === "crypto" ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Amount (USD)
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setAmount(preset);
                      setCustomAmount("");
                    }}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                      customAmount === "" && amount === preset
                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground ring-1 ring-border/30"
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="Custom amount"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="mt-2 w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Cryptocurrency
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {POPULAR_CRYPTOS.filter(
                  (c) => currencies.length === 0 || currencies.includes(c.value),
                ).map((crypto) => (
                  <button
                    key={crypto.value}
                    type="button"
                    onClick={() => setSelectedCrypto(crypto.value)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                      selectedCrypto === crypto.value
                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground ring-1 ring-border/30"
                    }`}
                  >
                    <span
                      className={`block text-xs ${
                        selectedCrypto === crypto.value
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground/70"
                      }`}
                    >
                      {crypto.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {estimate && (
              <p className="text-xs text-muted-foreground text-center font-mono">
                ≈ {estimate} {selectedCrypto.toUpperCase()}
              </p>
            )}

            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}

            <Button
              variant="glossy"
              className="w-full h-11 text-base font-bold"
              onClick={handleDonate}
              disabled={loading || activeAmount < 1}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Coins className="size-4 mr-2" />
              )}
              {loading ? "Creating payment…" : `Donate $${activeAmount}`}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-muted-foreground text-center">
              You&apos;ll be redirected to PayPal to complete your donation.
            </p>
            <Button
              variant="glossy"
              className="h-11 px-8 text-base font-bold"
              asChild
            >
              <a
                href={paypalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  className="size-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M7.076 21.337H2.47a.638.638 0 0 1-.624-.736L4.293 5.243a.77.77 0 0 1 .757-.636h5.922c2.874 0 4.845.885 5.424 2.984.09.327.14.66.148.996a3.744 3.744 0 0 1-.086.91l-.018.09-.02.091c-.526 2.68-2.218 3.662-4.357 4.218l-.133.033a9.44 9.44 0 0 1-2.162.226H7.344l-.793 4.408 4.766-.001h.073a7.283 7.283 0 0 0 3.02-.515c.998-.436 1.878-1.166 2.507-2.327l.057-.105c.5-.905.862-2.005 1.067-3.297l.013-.089.009-.063c.23-1.457.05-2.697-.487-3.633-.545-.947-1.463-1.542-2.644-1.803C12.811 4.808 11.86 4.71 10.878 4.71H6.024a.934.934 0 0 0-.918.798l-2.77 15.41a.639.639 0 0 0 .629.734l4.111-.001v-.314z" />
                </svg>
                Donate via PayPal
              </a>
            </Button>
          </div>
        )}
      </div>

      <CryptoPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        payment={payment}
      />
    </>
  );
}