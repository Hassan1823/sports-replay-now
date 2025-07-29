// app/not-found.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";

const NotFoundPage = () => {
  const router = useRouter();

  return (
    <main className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md text-center shadow-xl rounded-2xl">
        <CardContent className="py-10">
          <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
          <p className="text-lg text-muted-foreground mb-6">
            {` Oops! The page you're looking for doesn't exist.`}
          </p>
          <Button
            onClick={() => router.push("/")}
            className="w-full sm:w-auto cursor-pointer"
          >
            Go Back Home
          </Button>
        </CardContent>
      </Card>
    </main>
  );
};

export default NotFoundPage;
