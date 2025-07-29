"use client";

import Loading from "@/components/shared/loading";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const Protected = ({ children }: { children: React.ReactNode }) => {
  const { user, refreshToken, accessToken } = useProtectedRoute();
  const pathname = usePathname();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);

  // const protectedRoutes = ["/"];

  useEffect(() => {
    function checkRoutes() {
      try {
        setIsLoading(true);

        // for home route
        if (pathname === "/") {
          // if user is not logged in but visiting home route
          if (!user || !accessToken || !refreshToken) {
            router.replace("/login");
            return;
          }

          // if user is logged in but didn't purchase
          if (user && user.stripePaymentStatus !== "paid") {
            router.replace("/plans");
          }
        }
      } catch (error) {
        console.log("🚀 ~ checkRoutes ~ error:", error);
        return;
      } finally {
        setIsLoading(false);
      }
    }

    checkRoutes();
  }, [accessToken, refreshToken, user, router, pathname]);

  if (isLoading) {
    return (
      <>
        <Loading fullScreen />
      </>
    );
  } else {
    return <>{children}</>;
  }
};

export default Protected;
