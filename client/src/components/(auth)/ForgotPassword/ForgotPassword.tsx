"use client";

import { sendResetPasswordEmail } from "@/app/api/auth/api";
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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const formSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

export function ForgotPasswordForm() {
  const [isSending, setIsSending] = useState(false);

  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit() {
    try {
      setIsSending(true);
      const email = form.getValues("email");

      if (!email) {
        toast.error("Please enter your email address.");
        return;
      }

      // calling the send email api
      const response = await sendResetPasswordEmail(email);

      if (response.success) {
        toast.success(response.message || "Reset email sent successfully!");
        toast.info(
          "Please check your email and click the reset password link."
        );
      } else {
        toast.error(response.message || "Failed to send reset email.");
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
            Enter your email address and we'll send you a link to reset your
            password
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your email address"
                        {...field}
                        type="email"
                        autoComplete="email"
                        className="rounded-full border-black focus:border-black bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
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
                {isSending ? <Loading size={20} /> : "Send Reset Link"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
