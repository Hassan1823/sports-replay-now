// app/api/verify-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer", "subscription"],
    });

    return NextResponse.json(session);
  } catch (err) {
    console.log("🚀 ~ GET ~ err:", err);
    return NextResponse.json({ error: "Invalid session ID" }, { status: 500 });
  }
}
