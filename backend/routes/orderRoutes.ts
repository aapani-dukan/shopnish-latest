// ordersRouter.ts
import { Router } from "express";
import { requireAuth } from "../server/middleware/authMiddleware";
import { 
    placeOrderFromCart, 
    placeOrderBuyNow, 
    getUserOrders, 
    getOrderTrackingDetails,
    getOrderDetail // ⭐ NEW: Specific Order Detail Controller Import करें
} from "../server/controllers/orderController";

const ordersRouter = Router();

// ✅ Cart से order place करने के लिए
ordersRouter.post("/", requireAuth, placeOrderFromCart);

// ✅ Direct Buy Now
ordersRouter.post("/buy-now", requireAuth, placeOrderBuyNow);

// ✅ Logged-in user के सभी orders fetch करने के लिए
ordersRouter.get("/", requireAuth, getUserOrders);

// ⭐ NEW: विशिष्ट ऑर्डर विवरण प्राप्त करने के लिए (e.g., /api/orders/170)
ordersRouter.get("/:orderId", requireAuth, getOrderDetail);

// ✅ ट्रैकिंग रूट (e.g., /api/orders/170/tracking)
ordersRouter.get("/:orderId/tracking", requireAuth, getOrderTrackingDetails);

export default ordersRouter;
