import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function VideoMenu({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sidebar */}
      <div className="absolute right-0 top-0 h-full w-64 bg-white shadow-lg p-4">
        <div className="flex flex-col space-y-4">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              logout();
              onClose();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
