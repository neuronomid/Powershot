function sortObject(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce(
      (result, key) => {
        const val = obj[key];
        result[key] =
          val && typeof val === "object" && !Array.isArray(val)
            ? sortObject(val as Record<string, unknown>)
            : val;
        return result;
      },
      {} as Record<string, unknown>,
    );
}

const BASE_URL = "https://api.nowpayments.io/v1";

function getApiKey(): string {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) throw new Error("NOWPAYMENTS_API_KEY is not set");
  return key;
}

async function api<T>(
  path: string,
  options?: RequestInit,
  maxRetries = 2,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const init: RequestInit = {
    ...options,
    headers: {
      "x-api-key": getApiKey(),
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  };

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res.json() as Promise<T>;

      // Retry transient upstream failures; surface client errors immediately.
      const retryable = res.status === 429 || res.status >= 500;
      const text = await res.text().catch(() => "");
      lastErr = new Error(`NowPayments API error ${res.status}: ${text}`);
      if (!retryable || attempt === maxRetries) throw lastErr;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries) throw lastErr;
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw lastErr ?? new Error("NowPayments request failed");
}

export type CurrencyInfo = {
  code: string;
  network?: string;
  icon?: string;
  name?: string;
};

export async function getStatus(): Promise<{ message: string }> {
  return api("/status");
}

export async function getCurrencies(): Promise<string[]> {
  const data = await api<{ currencies: string[] }>("/currencies");
  return data.currencies ?? [];
}

export async function getFullCurrencies(): Promise<CurrencyInfo[]> {
  const data = await api<{ currencies: CurrencyInfo[] }>("/full-currencies");
  return data.currencies ?? [];
}

export type EstimateParams = {
  amount: number;
  currencyFrom: string;
  currencyTo: string;
};

export type EstimateResult = {
  price_amount: number;
  price_currency: string;
  pay_amount: string;
  pay_currency: string;
};

export async function getEstimate(
  params: EstimateParams,
): Promise<EstimateResult> {
  const sp = new URLSearchParams({
    amount: String(params.amount),
    currency_from: params.currencyFrom,
    currency_to: params.currencyTo,
  });
  return api(`/estimate?${sp.toString()}`);
}

export type MinAmountResult = {
  currency_from: string;
  currency_to: string;
  min_amount: number;
};

export async function getMinAmount(
  currencyFrom: string,
  currencyTo: string,
): Promise<MinAmountResult> {
  const sp = new URLSearchParams({
    currency_from: currencyFrom,
    currency_to: currencyTo,
  });
  return api(`/min-amount?${sp.toString()}`);
}

export type CreatePaymentParams = {
  priceAmount: number;
  priceCurrency: string;
  payCurrency: string;
  orderId?: string;
  orderDescription?: string;
  ipnCallbackUrl?: string;
};

export type PaymentData = {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_amount: number;
  pay_currency: string;
  price_amount: number;
  price_currency: string;
  payin_extra_id: string | null;
  purchase_id: string;
  outcome_amount: number;
  outcome_currency: string;
  expiration_estimate_date: string;
};

export async function createPayment(
  params: CreatePaymentParams,
): Promise<PaymentData> {
  return api("/payment", {
    method: "POST",
    body: JSON.stringify({
      price_amount: params.priceAmount,
      price_currency: params.priceCurrency,
      pay_currency: params.payCurrency,
      ...(params.orderId && { order_id: params.orderId }),
      ...(params.orderDescription && {
        order_description: params.orderDescription,
      }),
      ...(params.ipnCallbackUrl && {
        ipn_callback_url: params.ipnCallbackUrl,
      }),
    }),
  });
}

export async function getPaymentStatus(
  paymentId: string,
): Promise<PaymentData> {
  return api(`/payment/${paymentId}`);
}

export async function verifyIpnSignature(
  body: Record<string, unknown>,
  signature: string,
): Promise<boolean> {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) return false;

  const sortedBody = sortObject(body);
  const encoded = new TextEncoder().encode(JSON.stringify(sortedBody));
  const keyData = new TextEncoder().encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoded);
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hex === signature;
}