// backend/server/roots/admin/adminProductsRoutes.ts
import { Router, Response } from 'express';
import { db } from '../../db';
import {
  products,
  approvalStatusEnum,
  categories,
  sellersPgTable
} from '../../../shared/backend/schema';
import { AuthenticatedRequest } from '../../middleware/verifyToken';
import { eq } from 'drizzle-orm';
import { authorize } from '../../middleware/authorize';
import { validateRequest } from '../../middleware/validation';
import { z } from 'zod';
import multer from 'multer';
import { uploadImage } from '../../cloudStorage';
import { v4 as uuidv4 } from "uuid";
import { syncProductImages } from '../../scripts/imageSync';
// ❗ memoryStorage because file.buffer is required
const upload = multer({ storage: multer.memoryStorage() });

const adminProductsRouter = Router();

// -------------------------- VALIDATION ------------------------------

const productIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID must be a number."),
  }),
});

const productUpdateBodySchema = z.object({
  name: z.string().optional(),
  nameHindi: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.string().optional(),
  unit: z.string().optional(),
  category: z.union([z.number(), z.string()]).optional(),
  stock: z.union([z.number(), z.string()]).optional(),
  minOrderQuantity: z.union([z.number(), z.string()]).optional(),
  maxOrderQuantity: z.union([z.number(), z.string()]).optional(),
  isActive: z.union([z.boolean(), z.string()]).optional(),
}).partial();


// ----------------------------------------------------------------------
// GET ALL PRODUCTS
// ----------------------------------------------------------------------
adminProductsRouter.get('/', authorize(['admin']), async (req, res) => {
  try {
    const all = await db.query.products.findMany({
      with: {
        seller: { columns: { id: true, businessName: true }},
        category: { columns: { id: true, name: true }}
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)]
    });

    return res.json(all);
  } catch (err) {
    console.error("❌ Error fetching all products:", err);
    return res.status(500).json({ error: "Failed to fetch products." });
  }
});


// ----------------------------------------------------------------------
// GET PENDING PRODUCTS
// ----------------------------------------------------------------------
adminProductsRouter.get('/pending', authorize(['admin']), async (req, res) => {
  try {
    const data = await db.query.products.findMany({
      where: eq(products.approvalStatus, "pending"),
      with: {
        seller: { columns: { id: true, businessName: true }},
        category: { columns: { id: true, name: true }}
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)]
    });

    return res.json(data);
  } catch (err) {
    console.error("❌ Error pending list:", err);
    return res.status(500).json({ error: "Failed to fetch pending products." });
  }
});


// ----------------------------------------------------------------------
// GET APPROVED PRODUCTS
// ----------------------------------------------------------------------
adminProductsRouter.get('/approved', authorize(['admin']), async (req, res) => {
  try {
    const data = await db.query.products.findMany({
      where: eq(products.approvalStatus, "approved"),
      with: {
        seller: { columns: { id: true, businessName: true }},
        category: { columns: { id: true, name: true }}
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)]
    });

    return res.json(data);
  } catch (err) {
    console.error("❌ Error approved list:", err);
    return res.status(500).json({ error: "Failed to fetch approved products." });
  }
});


// ----------------------------------------------------------------------
// GET SINGLE PRODUCT BY ID
// ----------------------------------------------------------------------
adminProductsRouter.get(
  '/:id',
  authorize(['admin']),
  validateRequest(productIdSchema),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const [product] = await db.query.products.findMany({
        where: eq(products.id, id),
        with: {
          seller: { columns: { id: true, businessName: true }},
          category: { columns: { id: true, name: true }}
        }
      });

      if (!product) {
        return res.status(404).json({ message: "Product not found." });
      }

      return res.json(product);

    } catch (err) {
      console.error(`❌ Error fetching product ID ${req.params.id}:`, err);
      return res.status(500).json({ error: "Failed to fetch product." });
    }
  }
);

adminProductsRouter.post('/sync-images', authorize(['admin']), async (req: any, res: Response) => {
  try {
    // ⚠️ हम इसे await नहीं करेंगे ताकि API तुरंत रिस्पॉन्स दे दे
    // और स्क्रिप्ट बैकग्राउंड में अपना काम करती रहे।
    syncProductImages()
      .then(() => console.log("✅ Background Sync Complete"))
      .catch((err) => console.error("❌ Background Sync Error:", err));

    return res.json({ 
      success: true, 
      message: "इमेज सिंकिंग बैकग्राउंड में शुरू हो गई है। आप अपना काम जारी रख सकते हैं।" 
    });
  } catch (err) {
    console.error("❌ Error starting image sync:", err);
    return res.status(500).json({ error: "सिंकिंग शुरू करने में विफल।" });
  }
});
// ----------------------------------------------------------------------
// APPROVE PRODUCT
// ----------------------------------------------------------------------
adminProductsRouter.patch(
  '/:id/approve',
  authorize(['admin']),
  validateRequest(productIdSchema),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const [approved] = await db.update(products)
        .set({
          approvalStatus: "approved",
          updatedAt: new Date()
        })
        .where(eq(products.id, id))
        .returning();

      if (!approved) {
        return res.status(404).json({ message: "Product not found." });
      }

      return res.json({
        message: "Product approved successfully.",
        product: approved
      });

    } catch (err) {
      console.error("❌ Error approving:", err);
      return res.status(500).json({ error: "Failed to approve product." });
    }
  }
);


// ----------------------------------------------------------------------
// REJECT PRODUCT
// ----------------------------------------------------------------------
adminProductsRouter.patch(
  '/:id/reject',
  authorize(['admin']),
  validateRequest(productIdSchema.extend({
    body: z.object({ reason: z.string().optional() })
  })),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { reason } = req.body;

      const [rejected] = await db.update(products)
        .set({
          approvalStatus: "rejected",
          rejectionReason: reason || null,
          updatedAt: new Date()
        })
        .where(eq(products.id, id))
        .returning();

      if (!rejected) {
        return res.status(404).json({ message: "Product not found." });
      }

      return res.json({
        message: "Product rejected.",
        product: rejected
      });

    } catch (err) {
      console.error("❌ Error rejecting:", err);
      return res.status(500).json({ error: "Failed to reject product." });
    }
  }
);


// ----------------------------------------------------------------------
// UPDATE PRODUCT
// ----------------------------------------------------------------------
adminProductsRouter.patch(
  '/:id',
  authorize(['admin']),
  upload.single('image'),
  validateRequest(productIdSchema.extend({ body: productUpdateBodySchema })),
  async (req: any, res: Response) => {
    try {
      const id = Number(req.params.id);
      const updateData = req.body;
      const file = req.file;

      const [existingProduct] = await db.query.products.findMany({
        where: eq(products.id, id)
      });

      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found." });
      }

      let imageUrl = existingProduct.image;

      if (file) {
        const uploaded = await uploadImage(
          file.buffer,
          `products/${existingProduct.sellerId}/${uuidv4()}-${file.originalname}`,
          file.mimetype
        );

        if (!uploaded) {
          return res.status(500).json({ error: "Image upload failed." });
        }

        imageUrl = uploaded;
      }

      if (updateData.category) {
        updateData.categoryId = parseInt(updateData.category);
        delete updateData.category;
      }

      const finalData: any = {
        ...updateData,
        image: imageUrl,
        updatedAt: new Date()
      };

      Object.keys(finalData).forEach(key => {
        if (finalData[key] === undefined) delete finalData[key];
      });

      const [updatedProduct] = await db
        .update(products)
        .set(finalData)
        .where(eq(products.id, id))
        .returning();

      return res.json({
        message: "Product updated successfully.",
        product: updatedProduct
      });

    } catch (err: any) {
      console.error(`❌ Update error (ID ${req.params.id}):`, err);
      return res.status(500).json({ error: err.message || "Failed to update product." });
    }
  }
);


// ----------------------------------------------------------------------
// DELETE PRODUCT
// ----------------------------------------------------------------------
adminProductsRouter.delete(
  '/:id',
  authorize(['admin']),
  validateRequest(productIdSchema),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const [deleted] = await db.delete(products)
        .where(eq(products.id, id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Product not found." });
      }

      return res.json({
        message: "Product deleted successfully.",
        product: deleted
      });

    } catch (err) {
      console.error("❌ Delete error:", err);
      return res.status(500).json({ error: "Failed to delete product." });
    }
  }
);

export default adminProductsRouter;
