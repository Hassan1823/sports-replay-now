import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type LoadingProps = {
  size?: number; // size in pixels
  fullScreen?: boolean;
  className?: string;
  white?: boolean;
};

const Loading = ({
  size = 24,
  fullScreen = false,
  className,
  white = false,
}: LoadingProps) => {
  const spinner = (
    <Loader2
      className={cn(
        `animate-spin ${white ? "text-white" : "text-inherit"}`,
        className
      )}
      style={{ width: size, height: size }}
    />
  );

  if (fullScreen) {
    return (
      <div
        className={`flex items-center ${
          white ? "text-white" : "text-inherit"
        } justify-center min-h-screen w-full`}
      >
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default Loading;
