import { Router } from "express";
import {
  changeCurrentPassword,
  loginUser,
  registerUser,
  sendResetPasswordEmail,
} from "../controller/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// * register user route
router.route("/register").post(registerUser);

// * user login
router.route("/login").post(loginUser);

// *  send reset password email
router.route("/reset-email").post(sendResetPasswordEmail);

// * update password
router.route("/change-password").post(verifyJWT, changeCurrentPassword);

export default router;
