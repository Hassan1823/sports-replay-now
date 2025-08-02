import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type LoadingProps = {
  size?: number; // size in pixels
  fullScreen?: boolean;
  className?: string;
};

const Loading = ({
  size = 24,
  fullScreen = false,
  className,
}: LoadingProps) => {
  const spinner = (
    <Loader2
      className={cn("animate-spin text-inherit", className)}
      style={{ width: size, height: size }}
    />
  );

  if (fullScreen) {
    return (
      <div className="flex items-center text-inherit justify-center min-h-screen w-full">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default Loading;
