"use client";
import Navbar from "@/components/Home/Navbar";
import { PricingCard } from "@/components/plans/PricingCard";
import Loading from "@/components/shared/loading";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Protected from "../protected";

const Plans = () => {
  const [isLoading, setIsLoading] = useState(false);

  // const router = useRouter();
  const { user, login, token } = useAuth();

  //* stripe info
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id");
  const success = searchParams?.get("success");

  const hasProcessed = useRef(false);
  const router = useRouter();

  //  hold the page for 1 sec
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // * saving the payment details to DB
  // * or redirecting to plans if sessionId or success is not valid
  useEffect(() => {
    const savePaymentDetails = async () => {
      try {
        setIsLoading(true);
        // 1. Fetch Stripe session data
        const sessionRes = await fetch(
          `/api/verify-session?session_id=${sessionId}`
        );
        const session = await sessionRes.json();

        // 2. Prepare data for your API
        const paymentData = {
          email: session.customer.email || session.metadata.userEmail,
          stripeCustomerId: session.customer.id,
          stripeSubscriptionId: session.subscription.id,
          stripePaymentStatus: "paid",
          subscriptionExpiry: new Date(session.expires_at * 1000), // Convert Unix timestamp to Date
          planType: "annual",
          phone: "", // Optional: Add if collected earlier
          userId: user ? user._id : null,
        };

        // 3. Call your payment-details API
        const saveRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/payments/payment-details`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(paymentData),
          }
        );

        const result = await saveRes.json();
        console.log("🚀 ~ savePaymentDetails ~ result:", result);
        if (result.success) {
          localStorage.setItem("accessToken", result.data.accessToken);
          localStorage.setItem("refreshToken", result.data.refreshToken);
          localStorage.setItem("user", JSON.stringify(result.data.user));
          const tokenData = {
            accessToken: result.data.accessToken,
            refreshToken: result.data.refreshToken,
          };
          login(result.data.user);
          token(tokenData);
          router.push("/videos");
          // toast.success(result.message || "Payment Success!");
        }
      } catch (error) {
        console.log("🚀 ~ savePaymentDetails ~ error:", error);
        toast.error("Please try again later.");
      } finally {
        setIsLoading(false);
        hasProcessed.current = true;
      }
    };

    if (!sessionId || hasProcessed.current) return;

    savePaymentDetails();

    if (sessionId && success && user!.stripePaymentStatus === "paid") {
      router.push("/");
      return;
    }
  }, [sessionId, user, success, login, router, token]);

  // * if loading is true
  if (isLoading) {
    return (
      <div className="">
        <Loading fullScreen />
      </div>
    );
  }

  return (
    <div>
      <Protected>
        <Navbar />

        <PricingCard />
      </Protected>
    </div>
  );
};

export default Plans;
