"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";

function useQrSize(): number {
  const [size, setSize] = useState(192);
  useEffect(() => {
    const update = () => {
      setSize(window.innerWidth < 400 ? 160 : 192);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type PaymentStatus =
  | "waiting"
  | "confirming"
  | "confirmed"
  | "sending"
  | "partially_paid"
  | "finished"
  | "failed"
  | "refunded"
  | "expired";

interface CryptoPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: {
    paymentId: string;
    payAddress: string;
    payAmount: number;
    payCurrency: string;
    priceAmount: number;
    priceCurrency: string;
    expirationDate?: string;
  } | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; description: string }
> = {
  waiting: {
    label: "Waiting for payment",
    color: "text-amber-500",
    description: "Send the exact amount to the address above.",
  },
  confirming: {
    label: "Confirming",
    color: "text-blue-500",
    description: "Transaction detected. Awaiting blockchain confirmations.",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-blue-500",
    description: "Transaction confirmed on the blockchain.",
  },
  sending: {
    label: "Processing",
    color: "text-blue-500",
    description: "Funds are being transferred to our wallet.",
  },
  partially_paid: {
    label: "Partially paid",
    color: "text-amber-500",
    description: "You sent less than the required amount.",
  },
  finished: {
    label: "Thank you!",
    color: "text-emerald-500",
    description: "Your donation has been received. Thank you for supporting Powershot!",
  },
  failed: {
    label: "Payment failed",
    color: "text-destructive",
    description: "Something went wrong. Please try again.",
  },
  refunded: {
    label: "Refunded",
    color: "text-muted-foreground",
    description: "The payment was refunded.",
  },
  expired: {
    label: "Expired",
    color: "text-muted-foreground",
    description: "The payment window has expired. Please try again.",
  },
};

export function CryptoPaymentDialog({
  open,
  onOpenChange,
  payment,
}: CryptoPaymentDialogProps) {
  const [status, setStatus] = useState<PaymentStatus>("waiting");
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrSize = useQrSize();

  const pollStatus = useCallback(() => {
    if (!payment) return;
    fetch(`/api/donate/status/${payment.paymentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.payment?.payment_status) {
          setStatus(data.payment.payment_status as PaymentStatus);
        }
      })
      .catch(() => {});
  }, [payment]);

  useEffect(() => {
    if (!open || !payment) return;

    pollStatus();
    intervalRef.current = setInterval(pollStatus, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, payment, pollStatus]);

  useEffect(() => {
    if (!payment?.expirationDate) return;

    const update = () => {
      if (!payment.expirationDate) {
        setCountdown("");
        return;
      }
      const diff =
        new Date(payment.expirationDate).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("Expired");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setCountdown(`${mins}:${secs.toString().padStart(2, "0")}`);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [payment?.expirationDate]);

  const handleCopy = useCallback(() => {
    if (!payment) return;
    navigator.clipboard.writeText(payment.payAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [payment]);

  if (!payment) return null;

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.waiting;
  const isTerminal = ["finished", "failed", "refunded", "expired"].includes(
    status,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isTerminal && status === "finished" ? (
              <span className="text-emerald-500">♥</span>
            ) : null}
            {isTerminal && status !== "finished"
              ? config.label
              : "Send your donation"}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        {!isTerminal && (
          <>
            <div className="flex flex-col items-center gap-4 py-4">
              <QRCodeSVG
                value={payment.payAddress}
                size={qrSize}
                level="M"
                bgColor="transparent"
                fgColor="currentColor"
                className="text-foreground"
              />

              <div className="w-full space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Send exactly
                  </p>
                  <p className="text-lg font-bold text-foreground font-mono">
                    {payment.payAmount} {payment.payCurrency.toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ≈ {payment.priceAmount} {payment.priceCurrency.toUpperCase()}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    To this address
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded-lg bg-muted px-3 py-2 text-xs font-mono text-foreground">
                      {payment.payAddress}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {payment.payCurrency === "xrp" && (
                  <p className="text-xs text-muted-foreground">
                    Destination tag may be required. Check the payment details.
                  </p>
                )}

                {countdown && (
                  <p className="text-xs text-muted-foreground text-center">
                    Expires in: <span className="font-mono font-semibold">{countdown}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className={`size-2 rounded-full ${status === "waiting" ? "bg-amber-500 animate-pulse" : "bg-blue-500 animate-pulse"}`} />
              <span className={config.color}>{config.label}</span>
            </div>
          </>
        )}

        {isTerminal && status !== "finished" && (
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}

        {status === "finished" && (
          <div className="flex justify-end pt-2">
            <Button variant="glossy" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}