import axios from "axios";
import { api_url } from ".";

export const login = (username, password) =>
  axios
    .post(api_url("/auth/login"), { username, password })
    .then((res) => res.data)
    .catch((error) => {
      if (error.response) {
        // Server responded with a status other than 2xx
        throw new Error(error.response.data.message || "An error occurred");
      } else if (error.request) {
        // Request was made but no response received
        throw new Error("No response from server. Please try again later.");
      } else {
        // Something else happened
        throw new Error(error.message || "An unexpected error occurred");
      }
    });

export const forgetPassword = (username) =>
  axios
    .post(api_url("/auth/forgot-password"), { username })
    .then((res) => res.data)
    .catch((error) => {
      if (error.response) {
        // Server responded with a status other than 2xx
        throw new Error(error.response.data.message || "An error occurred");
      } else if (error.request) {
        // Request was made but no response received
        throw new Error("No response from server. Please try again later.");
      } else {
        // Something else happened
        throw new Error(error.message || "An unexpected error occurred");
      }
    });

export const changePassword = (currentPassword, newPassword) =>
  axios
    .post(api_url("/auth/change-password"), { currentPassword, newPassword })
    .then((res) => res.data)
    .catch((error) => {
      if (error.response) {
        // Server responded with a status other than 2xx
        throw new Error(error.response.data.message || "An error occurred");
      } else if (error.request) {
        // Request was made but no response received
        throw new Error("No response from server. Please try again later.");
      } else {
        // Something else happened
        throw new Error(error.message || "An unexpected error occurred");
      }
    });