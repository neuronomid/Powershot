// Runtime: Edge — receives IPN callbacks from NowPayments.
// Verifies the HMAC-SHA512 signature to ensure authenticity.
export const runtime = "edge";

import { verifyIpnSignature } from "@/lib/donate/nowpayments";

export async function POST(request: Request) {
  const signature = request.headers.get("x-nowpayments-sig");
  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!verifyIpnSignature(body, signature)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // IPN received and verified. In a production app you'd persist the
  // payment status update here. Since Powershot stores no server-side
  // data, the client polls /api/donate/status/[id] for updates instead.
  console.log(
    "IPN verified:",
    body.payment_id,
    body.payment_status,
  );

  return Response.json({ received: true });
}