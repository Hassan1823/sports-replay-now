import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  try {
    const { email } = await request.json(); // Get email from frontend

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "1-Year Subscription",
            },
            unit_amount: 10000, // $100 in cents
            recurring: {
              interval: "year",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      customer_email: email, // Pre-fill the email field in Stripe checkout
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/plans?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/plans&?canceled=true`,
      metadata: {
        userEmail: email, // Critical for linking payment to user
      },
    });

    return NextResponse.json({ id: session.id });
  } catch (err) {
    console.log("🚀 ~ POST ~ err:", err);
    return NextResponse.json(
      { error: "Error creating checkout session" },
      { status: 500 }
    );
  }
}
