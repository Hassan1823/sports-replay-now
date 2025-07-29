import { Router } from "express";
import { paymentDetails } from "../controller/payment.controller.js";

const router = Router();

// * saving payment details route
router.route("/payment-details").post(paymentDetails);

export default router;
