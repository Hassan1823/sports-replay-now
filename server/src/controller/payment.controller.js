import { Payment } from "../models/payment.model.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateAccessAndRefreshTokens } from "./user.controller.js";
import { createPeerTubeAccount } from "./peertube.controller.js";
import { Peertube } from "../models/peertube.model.js";

// * saving payment details
const paymentDetails = asyncHandler(async (req, res) => {
  try {
    const {
      email,
      phone,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePaymentStatus,
      subscriptionExpiry,
      planType,
      userId,
    } = req.body;

    if (
      [
        email,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePaymentStatus,
        subscriptionExpiry,
        planType,
        userId,
      ].some(
        (field) =>
          typeof field === "undefined" ||
          field === null ||
          String(field).trim() === ""
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required!",
      });
      // throw new ApiError(400, "All fields are required");
    }

    //   create or update payment details
    const paymentDetails = await Payment.findOneAndUpdate(
      { email },
      {
        phone,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePaymentStatus,
        subscriptionExpiry,
        planType,
        userId,
      },
      { new: true, upsert: true, runValidators: true }
    );

    if (!paymentDetails) {
      return res.status(500).json({
        success: false,
        message: "Payment Error!",
      });
      // throw new ApiError(500, "Payment Error!");
    }

    // finding the user
    const isUser = await User.findById(userId);

    if (!isUser) {
      console.log("No User fonund in");
    }

    let response;
    if (isUser) {
      // creating peertube account and saving
      response = await createPeerTubeAccount(
        isUser.email,
        isUser.password,
        isUser._id.toString()
      );
    }
    console.log("🚀 ~ paymentDetails ~ response:", response.data || "no data");

    let peer;

    // saving data to db
    if (response && response.data && response.data.user) {
      peer = await Peertube.create({
        userId: isUser._id,
        peertubeUserId: response.data.user.id,
        peertubeAccountId: response.data.user.accountId,
        peertubeUsername: response.data.user.username,
        peertubeChannelId: response.data.user.channelId || null,
        channelName: response.data.user.channelName || null,
      });
    }

    // updating user with payment details
    const userUpdateData = {
      paymentId: paymentDetails._id,
      stripePaymentStatus: paymentDetails.stripePaymentStatus,
    };
    if (peer && peer._id) {
      userUpdateData.peertubeId = peer._id;
    }

    const user = await User.findByIdAndUpdate(userId, userUpdateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(500).json({
        success: false,
        message: "User update failed!",
      });
      // throw new ApiError(500, "User update failed!");
    }

    const { accessToken, refreshToken } =
      await generateAccessAndRefreshTokens(userId);

    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken"
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
        paid: true,
        data: {
          user: loggedInUser,
          accessToken,
          refreshToken,
          paymentDetails,
        },
        message: "Payment Success!",
      });

    // return res
    //   .status(200)
    //   .json(new ApiResponse(200, paymentDetails, "Payment Success!"));
  } catch (error) {
    console.log("🚀 ~ paymentDetails ~ error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// * cancel subscription
const cancelSubscription = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required!",
      });
    }

    // Find the user and their payment details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found!",
      });
    }

    const payment = await Payment.findOne({ userId });
    if (!payment) {
      return res.status(400).json({
        success: false,
        message: "No payment details found!",
      });
    }

    // Update payment status to canceled
    await Payment.findByIdAndUpdate(payment._id, {
      stripePaymentStatus: "canceled",
    });

    // Update user payment status
    await User.findByIdAndUpdate(userId, {
      stripePaymentStatus: "canceled",
    });

    return res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully.",
    });
  } catch (error) {
    console.log("🚀 ~ cancelSubscription ~ error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

// * exports
export { paymentDetails, cancelSubscription };
