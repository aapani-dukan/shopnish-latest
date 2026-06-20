import { Router } from "express";

import {
  getCategories,
  getCategorySubcategories,
} from "../server/controllers/categoryController";

const router = Router();

// =========================
// Categories
// =========================

router.get(
  "/",
  getCategories
);

// =========================
// Category Sub Categories
// =========================

router.get(
  "/:categoryId/subcategories",
  getCategorySubcategories
);

export default router;