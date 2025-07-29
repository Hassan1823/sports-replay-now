"use client";

import { sendResetPasswordEmail, updatePassword } from "@/app/api/auth/api";
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
    code: z.string().min(6, {
      message: "Code must be at least 6 characters.",
    }),
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

export function ForgotPasswordForm() {
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [isSending, setIsSending] = useState(false);

  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const searchParams = useSearchParams();
  const email = searchParams?.get("email") || "";

  async function onSubmit() {
    try {
      setIsSending(true);
      const otp = form.getValues("code");
      const newPassword = form.getValues("newPassword");
      const confirmPassword = form.getValues("confirmPassword");
      if (!otp || !newPassword || !confirmPassword) {
        toast.error("Please fill in all fields.");
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }

      // calling the send email api
      const response = await updatePassword(otp, email, newPassword);

      if (response.success) {
        toast.success(response.message || "Password updated successfully!");
        router.replace("/login");
      } else {
        toast.error(response.message || "Failed to update password.");
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
      setIsSending(false);
    }
  }

  // resend opt
  const handleSendCode = async () => {
    setIsCodeSent(true);
    try {
      if (!email) {
        toast.error("You are not allowed");
        return;
      }

      // calling the send email api
      const response = await sendResetPasswordEmail(email);

      if (response.success) {
        toast.success(response.message || "Reset email sent");
        router.push(response.link);
      } else {
        toast.error(response.message || "Failed to send reset email.");
      }
    } catch (error) {
      console.log("🚀 ~ handleSendResetEmail ~ error:", error);
      toast.error("Something went wrong!");
    }
    // Start countdown
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsCodeSent(false);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    // Implement your send code logic here
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-[95%] md:max-w-[70%] lg:max-w-[50%] border-none shadow-none">
        <CardHeader>
          <CardTitle className="text-4xl font-extrabold text-center">
            Forgot Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground text-center mb-6">
            Enter the code you received in your email and choose a new password
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Code */}
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Code
                      <span className="text-muted-foreground">{`(required)`}</span>
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      The code that you received
                    </p>
                    <FormControl>
                      <Input
                        placeholder="Enter the 6-digit code"
                        {...field}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        onKeyDown={(e) => {
                          // Prevent non-numeric characters
                          if (
                            // Allow: backspace, delete, tab, escape, enter
                            [
                              "Backspace",
                              "Delete",
                              "Tab",
                              "Escape",
                              "Enter",
                            ].includes(e.key) ||
                            // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                            (e.ctrlKey === true &&
                              ["a", "c", "v", "x"].includes(e.key)) ||
                            // Allow: home, end, left, right
                            (e.key >= "ArrowLeft" && e.key <= "ArrowRight")
                          ) {
                            return;
                          }
                          // Ensure it's a number
                          if (e.key === " " || isNaN(Number(e.key))) {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          // Ensure the value is numeric and limit to 6 digits
                          const numericValue = e.target.value.replace(
                            /\D/g,
                            ""
                          );
                          const truncatedValue = numericValue.slice(0, 6);
                          field.onChange(truncatedValue);
                        }}
                        className="rounded-full border-black focus:border-black bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                disabled={isSending}
              >
                {isSending ? <Loading size={20} /> : "Reset Password"}
              </Button>

              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={isCodeSent}
                  className={`text-primary uppercase font-medium border-black border-2 rounded-full px-[3vw] py-2 hover:text-primary/80 ${
                    isCodeSent ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isCodeSent
                    ? `Resend code in ${countdown}s`
                    : "Send Code again"}
                </button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
