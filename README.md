# Shopify Preorder App

A simplified Shopify app scaffold to mark listings as preorder using product tags.

## What it does

- Authenticates a Shopify store via OAuth
- Loads products from the shop
- Toggles the `preorder` tag on products
- Provides a minimal web dashboard for managing preorder status

## Setup

1. Copy `.env.example` to `.env` for local development.
2. Set `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `HOST`, and `SESSION_SECRET`.
   - Do not commit `.env` to source control.
   - Keep `SHOPIFY_API_SECRET` and `SESSION_SECRET` private.
3. Install dependencies:

```bash
npm install
```

4. Run the app locally with Vercel:

```bash
npm run dev
```

5. Open the app in your browser and connect a store:

```text
http://localhost:3000
```

### Deploying on Vercel

- Add the same environment variables on Vercel.
- If you want persistence in production, add Vercel KV to your project and set the `VERCEL_KV_URL` value.
- Set `HOST` to your Vercel app URL, for example `https://your-app.vercel.app`.
- In Shopify Partner, use that URL for the App URL and `https://your-app.vercel.app/auth/callback` for the redirect URI.

### Notes

- The app now uses Vercel serverless API routes under `api/`.
- Product auth state is kept in a secure cookie and the shop token is stored separately.
- For production, the app works best with Vercel KV enabled.

## Requirements

- Node 18+
- A Shopify app created in Partner Dashboard
- App URL pointing to your app host

## Notes

- This scaffold uses product tags to identify preorder products.
- It is intentionally simple and designed as a clean foundation for extensions.
- For production, add persistent session storage, webhook handling, and app embedding.
