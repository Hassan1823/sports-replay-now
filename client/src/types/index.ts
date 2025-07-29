export type ApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: unknown;
};
export interface User {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  stripePaymentStatus: string;
  // Add other user properties as needed
  token?: string;
}

export interface Token {
  accessToken: string;
  refreshToken: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshToken: string;
  accessToken: string;
  isAuthenticated: boolean;
  login: (userData: User) => Promise<void>;
  token: (tokenData: Token) => Promise<void>;
  logout: () => void;
}
