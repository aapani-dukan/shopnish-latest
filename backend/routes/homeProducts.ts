import { Router } from "express";
import {
  viewProduct,
  addToCart,
  addToWishlist,
  placeOrder,
  getHomeProducts,
} from "../server/controllers/homeProductController";
import { verifyToken } from "middleware/verifyToken";
const router = Router();

// =========================
// HOME FEED
// =========================
router.get("/", verifyToken, getHomeProducts);

// Event Tracking
router.post("/product/view/:id", verifyToken, viewProduct);
router.post("/product/cart", verifyToken, addToCart);
router.post("/product/wishlist", verifyToken, addToWishlist);
router.post("/product/order", verifyToken, placeOrder);

export default router;