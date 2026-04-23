// Runtime: Edge — proxying NowPayments API, no Node-specific APIs needed.
export const runtime = "edge";

import { getEstimate } from "@/lib/donate/nowpayments";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const amount = url.searchParams.get("amount");
  const from = url.searchParams.get("currencyFrom");
  const to = url.searchParams.get("currencyTo");

  if (!amount || !from || !to) {
    return Response.json(
      { error: "Missing required params: amount, currencyFrom, currencyTo" },
      { status: 400 },
    );
  }

  const numAmount = Number(amount);
  if (Number.isNaN(numAmount) || numAmount <= 0) {
    return Response.json(
      { error: "amount must be a positive number" },
      { status: 400 },
    );
  }

  try {
    const estimate = await getEstimate({
      amount: numAmount,
      currencyFrom: from,
      currencyTo: to,
    });
    return Response.json({ estimate });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch estimate";
    return Response.json({ error: message }, { status: 502 });
  }
}