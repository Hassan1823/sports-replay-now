import { sendEmail } from "../lib/mail.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import crypto from "crypto";

export const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

// * register user
// const registerUser = asyncHandler(async (req, res) => {
//   try {
//     const { firstName, lastName, email, password, phone } = req.body;

//     // Validation
//     if (
//       [firstName, lastName, email, password].some(
//         (field) => field?.trim() === ""
//       )
//     ) {
//       throw new ApiError(400, "All fields are required");
//     }

//     // Check existing user
//     const existedUser = await User.findOne({ email });
//     if (existedUser) {
//       throw new ApiError(409, "User with email already exists");
//     }

//     // Create user
//     const user = await User.create({
//       firstName,
//       lastName,
//       email,
//       phone,
//       password,
//     });

//     // Return user without sensitive data
//     const createdUser = await User.findById(user._id).select(
//       "-password -refreshToken"
//     );

//     if (!createdUser) {
//       throw new ApiError(500, "Registration failed");
//     }

//     return res
//       .status(200)
//       .json(new ApiResponse(200, createdUser, "User registered successfully."));
//   } catch (error) {
//     console.error("Registration error:", error);
//     // Ensure you're sending JSON even for errors
//     res.status(500).json({
//       success: false,
//       message: error.message || "Internal server error",
//     });
//   }
// });

// * register user
const registerUser = asyncHandler(async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    // Validation
    if (
      [firstName, lastName, email, password].some(
        (field) => field?.trim() === ""
      )
    ) {
      throw new ApiError(400, "All fields are required");
    }

    // Check existing user
    const existedUser = await User.findOne({ email });
    if (existedUser) {
      throw new ApiError(409, "User with email already exists");
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password,
    });

    // Return user without sensitive data
    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new ApiError(500, "Registration failed");
    }

    // Generate tokens for auto-login
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        success: true,
        data: {
          user: createdUser,
          accessToken,
          refreshToken,
        },
        message: "User registered successfully",
      });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

// * user login
const loginUser = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email);

    if (!email) {
      // throw new ApiError(400, " email is required");
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      $or: [{ email }],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User does not exist",
      });
      // throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid user credentials",
      });
      // throw new ApiError(401, "Invalid user credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    let paid = false;

    // if the status is paid or not
    if (user.stripePaymentStatus === "paid") {
      paid = true;
    }

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json({
        success: true,
        paid,
        data: {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        message: "User logged In Successfully",
      });
  } catch (error) {
    console.log("🚀 ~ loginUser ~ error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

// * send reset password email
const sendResetPasswordEmail = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    // generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // check if account exist and update the reset token
    const isExist = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: resetTokenExpiry,
        },
      },
      { new: true }
    );

    if (!isExist) {
      return res.status(404).json({
        success: false,
        message: "User not found!",
      });
    }

    const redirectLink = `${process.env.CORS_ORIGIN}/reset-password?token=${resetToken}`;

    // send email to user
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto; border: 1px solid #eee; padding: 24px; border-radius: 8px;">
      <h2>Hello ${isExist.firstName || "User"},</h2>
      <p>You requested to reset your password. Click the button below to reset it:</p>
      <a href="${redirectLink}" 
         style="display: inline-block; padding: 12px 24px; background: #007bff; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">
        Reset Password
      </a>
      <p style="margin-top: 24px; color: #888; font-size: 12px;">This link will expire in 10 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: "Reset Your Password",
      html: htmlContent,
    });

    return res.status(200).json({
      success: true,
      link: redirectLink,
      message: "Please Check Your Email",
    });
  } catch (error) {
    console.log("🚀 ~ sendResetPasswordEmail ~ error:", error.message);
    // Log if it's an SMTP connection issue
    if (error.code) {
      console.log("SMTP Error Code:", error.code);
    }
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// * verify reset token and reset password
const resetPassword = asyncHandler(async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required",
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Update password and clear reset token
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.log("🚀 ~ resetPassword ~ error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// * update password
const changeCurrentPassword = asyncHandler(async (req, res) => {
  try {
    const { otp, email, newPassword } = req.body;
    console.log(
      "🚀 ~ changeCurrentPassword ~ otp, email, newPassword:",
      otp,
      email,
      newPassword
    );

    const user = await User.findOne(email);

    if (user && user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    user.password = newPassword;
    user.otp = "";
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: false,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.log("🚀 ~ changeCurrentPassword ~ error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// * get user by ID
const getUserById = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await User.findById(userId).select("-password -refreshToken");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.log("🚀 ~ getUserById ~ error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// * exports
export {
  registerUser,
  loginUser,
  sendResetPasswordEmail,
  resetPassword,
  changeCurrentPassword,
  getUserById,
};
