// ordersRouter.ts

import { Router, Request, Response, NextFunction, RequestHandler } from "express";
import { requireAuth } from "../server/middleware/authMiddleware";
import { 
    placeOrderFromCart, 
    placeOrderBuyNow, 
    getUserOrders, 
    getOrderTrackingDetails,
    getOrderDetail 
} from "../server/controllers/orderController";

const ordersRouter = Router();

// --- 🛒 POST Routes ---
// Yahan humne (req, res, next) pass kiya hai kyunki ye controllers 3 args maang rahe hain
ordersRouter.post("/", requireAuth, (async (req: any, res: Response, next: NextFunction) => {
    try { await placeOrderFromCart(req, res, next); } catch (e) { next(e); }
}) as RequestHandler);

ordersRouter.post("/buy-now", requireAuth, (async (req: any, res: Response, next: NextFunction) => {
    try { await placeOrderBuyNow(req, res, next); } catch (e) { next(e); }
}) as RequestHandler);


// --- 📦 GET Routes ---

// 1. सभी ऑर्डर्स प्राप्त करें
ordersRouter.get("/", requireAuth, (async (req: any, res: Response, next: NextFunction) => {
    try { await getUserOrders(req, res, next); } catch (e) { next(e); }
}) as RequestHandler);

// 2. ट्रैकिंग विवरण
ordersRouter.get("/:orderId/tracking", requireAuth, (async (req: any, res: Response, next: NextFunction) => {
    try { await getOrderTrackingDetails(req, res); } catch (e) { next(e); }
}) as RequestHandler);

// 3. मास्टर ऑर्डर विवरण (Yahan Error aa raha tha, isliye yahan sirf 2 args pass kiye hain)
ordersRouter.get("/:orderId/details", requireAuth, (async (req: any, res: Response) => {
    try { await getOrderDetail(req, res); } catch (e) { console.error(e); res.status(500).send(e); }
}) as RequestHandler);

// 4. मास्टर ऑर्डर विवरण (Backup route)
ordersRouter.get("/:orderId", requireAuth, (async (req: any, res: Response) => {
    try { await getOrderDetail(req, res); } catch (e) { console.error(e); res.status(500).send(e); }
}) as RequestHandler);


export default ordersRouter;