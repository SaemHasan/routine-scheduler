import express from "express";
const router = express.Router();

import { authenticate, updateEmail, changePassword } from "./controller.js";
import { authorize } from "../config/authorize.js";

router.post("/login", authenticate);
router.post("/forget-pass-req", authenticate);
router.post("/forget-pass", authenticate);
router.put("/update-email", updateEmail);
router.post("/change-password", authorize(), changePassword);

export default router;
