import dotenv from "dotenv";

dotenv.config();

export const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
export const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
export const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || "read_products,write_products,read_script_tags,write_script_tags";
export const HOST = process.env.HOST?.replace(/\/+$/, "") || "";
export const SESSION_SECRET = process.env.SESSION_SECRET;
export const APP_PASSWORD = process.env.APP_PASSWORD;

export function ensureEnv() {
  if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !HOST || !SESSION_SECRET) {
    throw new Error(
      "Missing required environment variables. Check .env.example and set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, HOST, and SESSION_SECRET."
    );
  }
}
