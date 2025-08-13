"use client";

import { resetPasswordWithToken } from "@/app/api/auth/api";
import Loading from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const formSchema = z
  .object({
    newPassword: z.string().min(6, {
      message: "Password must be at least 6 characters.",
    }),
    confirmPassword: z.string().min(6, {
      message: "Please confirm your password.",
    }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export function ResetPasswordForm() {
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Redirect if no token
  if (!token) {
    router.replace("/forgot-password");
    return null;
  }

  async function onSubmit() {
    try {
      setIsResetting(true);
      const newPassword = form.getValues("newPassword");
      const confirmPassword = form.getValues("confirmPassword");

      if (!newPassword || !confirmPassword) {
        toast.error("Please fill in all fields.");
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }

      // Call the reset password API
      const response = await resetPasswordWithToken(token, newPassword);

      if (response.success) {
        toast.success(response.message || "Password reset successfully!");
        router.replace("/login");
      } else {
        toast.error(response.message || "Failed to reset password.");
      }
    } catch (error) {
      console.log("🚀 ~ onSubmit ~ error:", error);
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Something went wrong!";
      toast.error(message);
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-[95%] md:max-w-[70%] lg:max-w-[50%] border-none shadow-none">
        <CardHeader>
          <CardTitle className="text-4xl font-extrabold text-center">
            Reset Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground text-center mb-6">
            Enter your new password below
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* New Password */}
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          className="rounded-full border-black focus:border-black bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 pr-10"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                          onClick={() => setShowNewPassword((v) => !v)}
                        >
                          {showNewPassword ? (
                            <EyeOff size={20} />
                          ) : (
                            <Eye size={20} />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Confirm Password */}
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repeat New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          className="rounded-full border-black focus:border-black bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 pr-10"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff size={20} />
                          ) : (
                            <Eye size={20} />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full rounded-full p-[3%]"
                disabled={isResetting}
              >
                {isResetting ? <Loading size={20} /> : "Reset Password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
