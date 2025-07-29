import { ApiResponse } from "@/types";
// Define this type based on your backend response

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
console.log("🚀 ~ API_BASE_URL:", API_BASE_URL);

//* register user
// export const registerUser = async (userData: {
//   firstName: string;
//   lastName: string;
//   email: string;
//   password: string;
//   phone?: string;
// }): Promise<ApiResponse> => {
//   try {
//     const response = await fetch(`${API_BASE_URL}/users/register`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(userData),
//       credentials: "include",
//     });

//     // Handle non-OK responses
//     if (!response.ok) {
//       // Try to parse error as JSON, fallback to text
//       let errorData;
//       try {
//         errorData = await response.json();
//       } catch {
//         errorData = { message: await response.text() };
//       }
//       throw new Error(errorData.message || "Registration failed");
//     }

//     return await response.json();
//   } catch (error) {
//     console.error("Registration error:", error);
//     throw error;
//   }
// };

//* register user
export const registerUser = async (userData: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
      credentials: "include",
    });

    // Handle non-OK responses
    if (!response.ok) {
      // Try to parse error as JSON, fallback to text
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: await response.text() };
      }
      throw new Error(errorData.message || "Registration failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
};

// * user login
export const loginUser = async (userData: {
  email: string;
  password: string;
}): Promise<ApiResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
      credentials: "include",
    });

    // Handle non-OK responses
    if (!response.ok) {
      // Try to parse error as JSON, fallback to text
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: await response.text() };
      }
      throw new Error(errorData.message || "Registration failed");
    }

    return await response.json();
  } catch (error) {
    console.log("🚀 ~ error:", error);
    throw error;
  }
};

// * send reset password email
export const sendResetPasswordEmail = async (email: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/reset-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      credentials: "include",
    });

    // Handle non-OK responses
    if (!response.ok) {
      // Try to parse error as JSON, fallback to text
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: await response.text() };
      }
      throw new Error(errorData.message || "Send reset password email failed");
    }

    return await response.json();
  } catch (error) {
    console.log("🚀 ~ sendResetPasswordEmail ~ error:", error);
    throw error;
  }
};

// * send reset password email
export const updatePassword = async (
  otp: string,
  email: string,
  newPassword: string
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ otp, email, newPassword }),
      credentials: "include",
    });

    // Handle non-OK responses
    if (!response.ok) {
      // Try to parse error as JSON, fallback to text
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: await response.text() };
      }
      throw new Error(errorData.message || "Update password failed");
    }

    return await response.json();
  } catch (error) {
    console.log("🚀 ~ error:", error);
    throw error;
  }
};
