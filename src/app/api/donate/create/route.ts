// Runtime: Edge — proxying NowPayments API, no Node-specific APIs needed.
export const runtime = "edge";

import { createPayment } from "@/lib/donate/nowpayments";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    priceAmount?: number;
    priceCurrency?: string;
    payCurrency?: string;
  };

  const { priceAmount, priceCurrency, payCurrency } = body;

  if (!priceAmount || !priceCurrency || !payCurrency) {
    return Response.json(
      { error: "Missing required fields: priceAmount, priceCurrency, payCurrency" },
      { status: 400 },
    );
  }

  if (typeof priceAmount !== "number" || priceAmount <= 0) {
    return Response.json(
      { error: "priceAmount must be a positive number" },
      { status: 400 },
    );
  }

  try {
    const host = request.headers.get("host") ?? "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") ?? "https";
    const ipnCallbackUrl = `${protocol}://${host}/api/donate/ipn`;

    const payment = await createPayment({
      priceAmount,
      priceCurrency,
      payCurrency,
      orderDescription: "Donation to Powershot",
      ipnCallbackUrl,
    });

    return Response.json({ payment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create payment";
    return Response.json({ error: message }, { status: 502 });
  }
}