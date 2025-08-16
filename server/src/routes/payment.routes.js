import { Router } from "express";
import {
  paymentDetails,
  cancelSubscription,
} from "../controller/payment.controller.js";

const router = Router();

// * saving payment details route
router.route("/payment-details").post(paymentDetails);

// * cancel subscription route
router.route("/cancel-subscription").post(cancelSubscription);

export default router;
