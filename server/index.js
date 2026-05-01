import express from "express";
import session from "cookie-session";
import path from "path";
import crypto from "crypto";
import {fileURLToPath} from "url";
import dotenv from "dotenv";
import {
  buildShopifyAuthUrl,
  verifyShopifyHmac,
  exchangeTemporaryCode,
  shopifyRequest
} from "./shopify.js";

dotenv.config();

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_SCOPES = "read_products,write_products",
  HOST,
  SESSION_SECRET
} = process.env;

if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !HOST || !SESSION_SECRET) {
  console.error("Missing required environment variables. Check .env.example and populate SHOPIFY_API_KEY, SHOPIFY_API_SECRET, HOST, and SESSION_SECRET.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const accessTokens = {};

app.use(express.json());
app.use(
  session({
    name: "preorder-session",
    keys: [SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000
  })
);
app.use(express.static(path.join(__dirname, "../public")));

function validateShopDomain(shop) {
  return typeof shop === "string" && shop.endsWith(".myshopify.com");
}

function requireShopAuth(req, res, next) {
  const shop = req.session?.shop;
  if (!shop || !accessTokens[shop]) {
    return res.status(401).json({error: "Authentication required. Visit / and connect your shop."});
  }
  req.shop = shop;
  req.accessToken = accessTokens[shop];
  next();
}

app.get("/health", (req, res) => {
  res.send({status: "ok"});
});

app.get("/auth", (req, res) => {
  const shop = req.query.shop;
  if (!validateShopDomain(shop)) {
    return res.status(400).send("Invalid shop domain. Use your-shop.myshopify.com");
  }

  const state = crypto.randomBytes(16).toString("hex");
  req.session.state = state;

  const redirectUri = `${HOST}/auth/callback`;
  const authUrl = buildShopifyAuthUrl({
    shop,
    apiKey: SHOPIFY_API_KEY,
    scopes: SHOPIFY_SCOPES,
    redirectUri,
    state
  });

  res.redirect(authUrl);
});

app.get("/auth/callback", async (req, res) => {
  const {shop, hmac, code, state} = req.query;

  if (state !== req.session.state) {
    return res.status(400).send("Request origin cannot be verified.");
  }

  if (!verifyShopifyHmac(req.query)) {
    return res.status(400).send("HMAC validation failed.");
  }

  try {
    const tokenResponse = await exchangeTemporaryCode({
      shop,
      apiKey: SHOPIFY_API_KEY,
      apiSecret: SHOPIFY_API_SECRET,
      code
    });

    accessTokens[shop] = tokenResponse.access_token;
    req.session.shop = shop;
    res.redirect("/app.html");
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to complete Shopify authorization.");
  }
});

app.get("/api/products", requireShopAuth, async (req, res) => {
  try {
    const response = await shopifyRequest({
      shop: req.shop,
      accessToken: req.accessToken,
      path: "/products.json?fields=id,title,handle,tags&limit=50"
    });

    const products = response.products.map((product) => {
      const tags = product.tags ? product.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        tags,
        preorder: tags.includes("preorder")
      };
    });

    res.json({products});
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Unable to load products."});
  }
});

app.post("/api/products/:id/preorder", requireShopAuth, async (req, res) => {
  const productId = req.params.id;
  const {preorder} = req.body;

  if (typeof preorder !== "boolean") {
    return res.status(400).json({error: "Request body must contain preorder boolean."});
  }

  try {
    const productResponse = await shopifyRequest({
      shop: req.shop,
      accessToken: req.accessToken,
      path: `/products/${productId}.json?fields=id,tags`
    });

    const currentTags = productResponse.product.tags
      ? productResponse.product.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];
    const activeTags = new Set(currentTags);

    if (preorder) {
      activeTags.add("preorder");
    } else {
      activeTags.delete("preorder");
    }

    const updatedProps = {
      product: {
        id: Number(productId),
        tags: Array.from(activeTags).join(", ")
      }
    };

    const updateResponse = await shopifyRequest({
      shop: req.shop,
      accessToken: req.accessToken,
      method: "PUT",
      path: `/products/${productId}.json`,
      body: updatedProps
    });

    const tags = updateResponse.product.tags
      ? updateResponse.product.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];

    res.json({
      id: updateResponse.product.id,
      title: updateResponse.product.title,
      handle: updateResponse.product.handle,
      tags,
      preorder: tags.includes("preorder")
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Unable to update preorder status."});
  }
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Shopify Preorder app running at http://localhost:${PORT}`);
});
