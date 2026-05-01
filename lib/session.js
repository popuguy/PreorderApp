import { getIronSession } from "iron-session";
import { SESSION_SECRET } from "./config.js";

const sessionOptions = {
  password: SESSION_SECRET,
  cookieName: "preorder_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    httpOnly: true,
    path: "/"
  }
};

export function getSession(req, res) {
  return getIronSession(req, res, sessionOptions);
}
