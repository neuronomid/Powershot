// Runtime: Edge — proxying NowPayments API, no Node-specific APIs needed.
export const runtime = "edge";

import { getPaymentStatus } from "@/lib/donate/nowpayments";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return Response.json(
      { error: "Missing payment ID" },
      { status: 400 },
    );
  }

  try {
    const payment = await getPaymentStatus(id);
    return Response.json({ payment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch payment status";
    return Response.json({ error: message }, { status: 502 });
  }
}