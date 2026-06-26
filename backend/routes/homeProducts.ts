import { Router } from "express";
import {
  viewProduct,
  addToCart,
  addToWishlist,
  placeOrder,
  getHomeProducts,
} from "../server/controllers/homeProductController";

const router = Router();

// =========================
// HOME FEED
// =========================
router.get("/home", getHomeProducts);

// =========================
// EVENT TRACKING ROUTES
// =========================
router.post("/product/view/:id", viewProduct);
router.post("/product/cart", addToCart);
router.post("/product/wishlist", addToWishlist);
router.post("/product/order", placeOrder);

export default router;