"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { loginUser, sendResetPasswordEmail } from "@/app/api/auth/api";
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
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { User } from "@/types";

const formSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
});

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { login, token } = useAuth();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true);

      const response = await loginUser(values);

      if (response.success) {
        toast.success(response.message || "Login successful!");
        // Type assertion for response.data
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

        router.push("/");
      } else {
        toast.error(response.message || "Login failed!");
      }
    } catch (error: unknown) {
      console.log("🚀 ~ onSubmit ~ error:", error);
      if (error instanceof Error) {
        toast.error(error.message || "Please try again later.");
      } else {
        toast.error("Please try again later.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // * handle send reset password email
  async function handleSendResetEmail() {
    try {
      setIsSending(true);
      const email = form.getValues("email");
      if (!email) {
        toast.error("Please enter your email.");
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
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] mb-[10vh]">
      <Card className="w-full max-w-[95%] md:max-w-[70%] lg:max-w-[50%] border-none shadow-none">
        <CardHeader>
          <CardTitle className="text-4xl font-extrabold text-center">
            LOGIN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground text-center mb-2">
            {` Don't have an Account? Click Here`}
          </p>

          <div className="flex justify-center mb-6">
            <Link href="/signup">
              <Button
                variant="default"
                size={"lg"}
                className="px-[5vw] rounded-full"
              >
                Signup Now
              </Button>
            </Link>
          </div>

          <p className="text-sm text-foreground text-center mb-6">
            Enter the email you used to create your account and Password below:
          </p>

          {/* email */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

              {/* password */}
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

              <Button type="submit" className="w-full rounded-full p-[3%]">
                {isSubmitting ? <Loading size={20} /> : "LOGIN"}
              </Button>

              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={handleSendResetEmail}
                  disabled={isSending}
                  className={`text-primary uppercase font-medium border-black border-2 rounded-full px-[3vw] py-2 hover:text-primary/80 cursor-pointer disabled:cursor-not-allowed`}
                >
                  {isSending ? <Loading size={20} /> : "Forgot Password?"}
                </button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
