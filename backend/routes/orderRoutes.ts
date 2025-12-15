// ordersRouter.ts

import { Router } from "express";
import { requireAuth } from "../server/middleware/authMiddleware";
import { 
    placeOrderFromCart, 
    placeOrderBuyNow, 
    getUserOrders, 
    getOrderTrackingDetails,
    getSubOrderDetails, // यह फ़ंक्शन अब केवल पुरानी सब-ऑर्डर ट्रैकिंग के लिए इस्तेमाल हो
    getOrderDetail // ⭐ Master Order Details Controller
} from "../server/controllers/orderController";

const ordersRouter = Router();

// ... (POST routes are fine)
ordersRouter.post("/", requireAuth, placeOrderFromCart);
ordersRouter.post("/buy-now", requireAuth, placeOrderBuyNow);

// ✅ 1. सभी ऑर्डर्स प्राप्त करें (सबसे सामान्य)
ordersRouter.get("/", requireAuth, getUserOrders);

// --------------------------------------------------------------------------
// 🛑 FIX: सबसे विशिष्ट रूट्स को पहले परिभाषित करें!
// --------------------------------------------------------------------------

// ✅ 2. ट्रैकिंग रूट (सबसे विशिष्ट)
// e.g., /api/orders/12/tracking
ordersRouter.get("/:orderId/tracking", requireAuth, getOrderTrackingDetails);

// ✅ 3. मास्टर ऑर्डर विवरण रूट (यह वह है जिसे आपका Frontend कॉल कर रहा है)
// e.g., /api/orders/12/details
ordersRouter.get("/:orderId/details", requireAuth, getOrderDetail); // **अब यह सही फ़ंक्शन कॉल करेगा**

// 🛑 REMOVE (या इसका नाम बदलें): यह रूट अनावश्यक है और conflict पैदा कर रहा था
// ordersRouter.get("/:orderId/details", requireAuth, getSubOrderDetails); 

// ✅ 4. मास्टर ऑर्डर विवरण प्राप्त करने का दूसरा/आकस्मिक तरीका (सबसे कम विशिष्ट)
// e.g., /api/orders/12
ordersRouter.get("/:orderId", requireAuth, getOrderDetail);

export default ordersRouter;
