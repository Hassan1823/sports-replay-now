"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import Loading from "@/components/shared/loading";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export function PricingCard() {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const isSubscribed = user?.stripePaymentStatus === "paid";

  const handleCheckout = async () => {
    if (!user) {
      toast.error("Please log in to continue.");
      return;
    }

    if (isSubscribed) {
      toast.message("Your subscription is already active");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          userId: user.id,
        }),
      });

      const { id } = await response.json();
      const stripe = await loadStripe(
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
      );

      if (stripe) {
        await stripe.redirectToCheckout({ sessionId: id });
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Payment processing failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[90vh] bg-gradient-to-b bg-transparent">
      <div className="w-full max-w-md px-4">
        <Card className="border border-gray-200 shadow-xl overflow-hidden p-0 space-y-0">
          {/* Price Header */}
          <div
            className={`py-6 ${
              isSubscribed
                ? "bg-gradient-to-r from-amber-800 to-gray-900"
                : "bg-black"
            }`}
          >
            <CardHeader className="text-center">
              <CardTitle className="text-4xl font-bold text-amber-50">
                {isSubscribed ? "✓ Premium Member" : "$100"}
                {!isSubscribed && (
                  <span className="text-lg font-normal">/year</span>
                )}
              </CardTitle>
              <p className="text-xl mt-2 text-amber-100">
                {isSubscribed ? "Full Access Granted" : "Exclusive Plan"}
              </p>
            </CardHeader>
          </div>

          <CardContent className="p-6 bg-white">
            {/* Checkout Button */}
            <Button
              onClick={handleCheckout}
              disabled={isLoading || isSubscribed}
              className={`w-full py-6 text-lg font-bold transition-all ${
                isSubscribed
                  ? "bg-gradient-to-r from-amber-700 to-amber-800 text-amber-50 hover:from-amber-800 hover:to-amber-900"
                  : "bg-black hover:bg-gray-900 text-white"
              } rounded-lg shadow-md`}
            >
              {isLoading ? (
                <Loading size={20} className="text-white" />
              ) : isSubscribed ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Active Membership
                </span>
              ) : (
                "Subscribe Now"
              )}
            </Button>
            {/* Features */}
            <div className="space-y-4 my-4">
              {[
                "$100/year",
                "Per terabyte",
                "Priority customer support",
                "No hidden fees",
                "Member-only features",
              ].map((feature) => (
                <div key={feature} className="flex items-center">
                  <CheckCircle2
                    className={`mr-2 ${
                      isSubscribed ? "text-amber-600" : "text-black"
                    }`}
                  />
                  <span className={isSubscribed ? "text-gray-800" : ""}>
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="text-center mb-8">
              <p className="text-gray-700 mb-6">
                {isSubscribed
                  ? "Thank you for your membership."
                  : "Premium annual subscription for $100 USD."}
              </p>
              {!isSubscribed && (
                <div className="bg-amber-50 border border-amber-200 p-4 mb-6 rounded-lg">
                  <p className="text-amber-800 font-medium">
                    Limited availability - Join today
                  </p>
                </div>
              )}
            </div>

            {!isSubscribed && (
              <p className="text-center text-sm text-gray-500 mt-4">
                30-day satisfaction guarantee
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
