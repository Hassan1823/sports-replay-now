"use client"; // Important for Next.js 13+ with TypeScript

import { AuthContextType, Token, User } from "@/types";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshToken, setRefreshToken] = useState("");
  const [accessToken, setAccessToken] = useState("");

  useEffect(() => {
    async function loadUser() {
      try {
        const storedUser = localStorage.getItem("user");
        const refreshToken = localStorage.getItem("refreshToken");
        const accessToken = localStorage.getItem("accessToken");
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        if (refreshToken) {
          setRefreshToken(refreshToken);
        }
        if (accessToken) {
          setAccessToken(accessToken);
        }
      } catch (error) {
        console.error("Failed to load user", error);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (userData: User): Promise<void> => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const token = async (tokenData: Token): Promise<void> => {
    setAccessToken(tokenData.accessToken);
    localStorage.setItem("accessToken", tokenData.accessToken);
    setRefreshToken(tokenData.refreshToken);
    localStorage.setItem("refreshToken", tokenData.refreshToken);
  };

  const logout = (): void => {
    setUser(null);
    localStorage.removeItem("user");
    setAccessToken("");
    localStorage.removeItem("accessToken");
    setRefreshToken("");
    localStorage.removeItem("refreshToken");
  };

  const refreshUser = async (): Promise<void> => {
    try {
      if (!user?._id) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${user._id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error("Failed to refresh user data", error);
    }
  };

  const updateUserStripeStatus = (status: string): void => {
    if (user) {
      const updatedUser = { ...user, stripePaymentStatus: status };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    refreshToken,
    accessToken,
    token,
    login,
    logout,
    refreshUser,
    updateUserStripeStatus,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
