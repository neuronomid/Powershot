// Runtime: Edge — proxying NowPayments API, no Node-specific APIs needed.
export const runtime = "edge";

import { getCurrencies } from "@/lib/donate/nowpayments";

export async function GET() {
  try {
    const currencies = await getCurrencies();
    return Response.json({ currencies });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch currencies";
    return Response.json({ error: message }, { status: 502 });
  }
}