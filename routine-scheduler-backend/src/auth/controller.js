import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import {
  adminExistsEmail,
  findAdminDB as findAdminUsingUsername,
  updateEmailDB,
  updatePasswordDB,
} from "./repository.js";
import { HttpError } from "../config/error-handle.js";

const secret = process.env.SECRET || "default-secret";
const saltRounds = 10;

export async function authenticate(req, res, next) {
  try {
    const admin = await findAdminUsingUsername(req.body.username);
    const result = await bcrypt.compare(req.body.password, admin.password);

    if (result) {
      const token = jwt.sign({ username: admin.username }, secret, {
        expiresIn: "2 days",
      });

      const { password, ...user } = admin;

      res.status(200).json({ message: "Logged in!", user, token });
    } else {
      throw new HttpError(401, "username or password is incorrect!");
    }
  } catch (error) {
    next(error);
  }
}

export async function forgetPassReq(req, res, next) {
  const email = req.body.email;
  if (await adminExistsEmail(email)) {
    // TODO: send email with reset link
    res.status(200).json({ message: "Check your email for the reset link!" });
  } else {
    throw new HttpError(404, "Email not found!");
  }
}

export async function updateEmail(req, res, next) {
  var username = req.username;
  var email = req.body.email;
  try {
    await updateEmailDB(email, username);
    res
      .status(200)
      .json({ message: "update successfull!", username: username });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req, res, next) {
  const username = req.username; // This comes from the authorize middleware
  const { currentPassword, newPassword } = req.body;

  try {
    // First, verify the current password
    const admin = await findAdminUsingUsername(username);
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);

    if (!isCurrentPasswordValid) {
      throw new HttpError(401, "Current password is incorrect!");
    }

    // Hash the new password
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update the password in the database
    await updatePasswordDB(username, newPasswordHash);

    res.status(200).json({ 
      message: "Password changed successfully!",
      username: username 
    });
  } catch (error) {
    next(error);
  }
}
