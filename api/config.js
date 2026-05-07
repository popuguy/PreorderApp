import { APP_PASSWORD } from "../lib/config.js";

export default function handler(req, res) {
  res.status(200).json({
    passwordRequired: !!APP_PASSWORD
  });
}