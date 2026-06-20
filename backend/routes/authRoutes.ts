import { Router } from "express";
import { registerUser, login,logout } from "../server/controllers/authController";
const authRouter = Router();

authRouter.post(
  "/register",
  registerUser
);

authRouter.post(
  "/login",
  login
);

authRouter.post(
  "/logout",
  logout
);

authRouter.post(
   "/register",
   registerUser
);

export default authRouter;