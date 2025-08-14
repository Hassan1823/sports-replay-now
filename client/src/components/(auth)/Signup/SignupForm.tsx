"use client";

import { registerUser } from "@/app/api/auth/api";
import { addSharedVideoToLibrary } from "@/app/api/peertube/api";
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
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { User } from "@/types";

const formSchema = z.object({
  firstName: z.string().min(1, {
    message: "First name is required.",
  }),
  lastName: z.string().min(1, {
    message: "Last name is required.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
  phone: z.string().optional(),

  // Stripe/payment fields
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  stripePaymentStatus: z
    .enum(["pending", "paid", "failed", "canceled"])
    .optional(),
  subscriptionExpiry: z.union([z.string(), z.date()]).nullable().optional(),
  planType: z.enum(["annual", "monthly", "none"]).optional(),
});

export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const sharedVideoId = searchParams.get("sharedVideoId");
  const { login, token } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      stripeCustomerId: "",
      stripeSubscriptionId: "",
      stripePaymentStatus: "pending",
      subscriptionExpiry: null,
      planType: "none",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true);
      console.log("Submitting:", values);

      const response = await registerUser(values);
      console.log("🚀 ~ onSubmit ~ response:", response);

      if (response.success) {
        toast.success(response.message || "Account created successfully!");

        // Auto-login the user
        const data = response.data as {
          accessToken: string;
          refreshToken: string;
          user: User;
        };

        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        localStorage.setItem("user", JSON.stringify(data.user));

        const tokenData = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };

        login(data.user);
        token(tokenData);

        // If there's a shared video ID, add it to the user's library
        if (sharedVideoId) {
          try {
            toast.loading("Adding shared video to your library...");
            await addSharedVideoToLibrary(sharedVideoId, data.user._id);
            toast.dismiss();
            toast.success(
              "Shared video added to your library! Check your 'sharedSeason' folder."
            );
          } catch (error) {
            console.error("Failed to add shared video to library:", error);
            toast.dismiss();
            toast.error(
              "Account created but failed to add video to library. You can manually add it later."
            );
          }
        }

        router.push("/");
      } else {
        toast.error(
          response.message || "Registration completed but with warnings"
        );
      }
    } catch (error: unknown) {
      console.error("Full registration error:", error);
      let errorMessage =
        "Registration failed. Please check console for details.";
      if (error instanceof Error) {
        errorMessage = error.message || error.toString() || errorMessage;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] mb-[10vh]">
      <Card className="w-full max-w-[95%] md:max-w-[70%] lg:max-w-[50%] border-none shadow-none">
        <CardHeader>
          {sharedVideoId && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-green-800 text-sm font-medium">
                🎥 You're signing up to get access to a shared video!
              </p>
              <p className="text-green-600 text-xs mt-1">
                This video will be automatically added to your library after
                signup.
              </p>
            </div>
          )}
          <CardTitle className="text-4xl font-extrabold text-center">
            SIGN UP OR LOGIN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground text-center mb-2">
            Have an Account Already? Click Here
          </p>

          <div className="flex justify-center mb-6">
            <Link href="/login">
              <Button
                variant="default"
                size={"lg"}
                className="px-[5vw] rounded-full"
              >
                Login
              </Button>
            </Link>
          </div>

          <h2 className="text-2xl font-bold text-center mb-6">
            CREATE AN ACCOUNT FOR FREE!
          </h2>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <input type="hidden" {...form.register("stripeCustomerId")} />
              <input type="hidden" {...form.register("stripeSubscriptionId")} />
              <input type="hidden" {...form.register("stripePaymentStatus")} />
              <input type="hidden" {...form.register("subscriptionExpiry")} />
              <input type="hidden" {...form.register("planType")} />

              {/* Name section */}
              <div className="space-y-2">
                <FormLabel>
                  Name
                  <span className="text-muted-foreground">{`(required)`}</span>
                </FormLabel>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* First Name */}
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John"
                            {...field}
                            className="rounded-full border-black focus:border-black bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Last Name */}
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Doe"
                            {...field}
                            className="rounded-full border-black focus:border-black bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Email
                      <span className="text-muted-foreground">{`(required)`}</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="your@email.com"
                        {...field}
                        className="rounded-full border-black focus:border-black bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          className="rounded-full border-black focus:border-black bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 pr-10"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                          onClick={() => setShowPassword((v) => !v)}
                        >
                          {showPassword ? (
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

              {/* Phone (optional) */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+1 (123) 456-7890"
                        {...field}
                        className="rounded-full border-black focus:border-black bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full rounded-full p-[3%]">
                {isSubmitting ? <Loading size={20} /> : "Let's GO!"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
