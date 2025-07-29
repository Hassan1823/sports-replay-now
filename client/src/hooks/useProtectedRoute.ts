"use client";

import { useEffect } from "react";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export function useProtectedRoute() {
  const { user, refreshToken, accessToken, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!refreshToken || !accessToken) {
      router.push("/login");
    }
  }, [refreshToken, accessToken, loading, router]);

  return { user, loading, refreshToken, accessToken };
}
