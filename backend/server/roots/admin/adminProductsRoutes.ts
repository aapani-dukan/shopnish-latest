// backend/server/roots/admin/adminProductsRoutes.ts (Updated)
import { Router, Response } from 'express';
import { db } from '../../db'; // Corrected path
import {
  products,
  approvalStatusEnum,
  categories, // ✅ Added for product updates
  sellersPgTable // ✅ Added for product updates (seller context)
} from '../../../shared/backend/schema';
import { AuthenticatedRequest } from '../../middleware/verifyToken'; // Corrected path
import { eq, and } from 'drizzle-orm';
import { authorize } from '../../middleware/authorize'; // ✅ Assuming authorize middleware
import { validateRequest } from '../../middleware/validateRequest';
import { z } from 'zod'; // ✅ For validation
import multer from 'multer'; // ✅ For image upload
import { uploadImage } from '../../cloudStorage'; // ✅ For image upload
import { v4 as uuidv4 } from "uuid"; // ✅ For unique filenames

const adminProductsRouter = Router();
const upload = multer({ dest: 'uploads/' });

// --- Validation Schemas ---
const productIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID must be a number."),
  }),
});

const productUpdateBodySchema = z.object({
  name: z.string().min(1, "Product name is required.").optional(),
  nameHindi: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid decimal number.").optional(),
  unit: z.string().min(1, "Unit is required (e.g., 'kg', 'piece').").optional(),
  category: z.number().int().min(1, "Category ID must be a positive integer.").optional(), // Frontend may send categoryId
  stock: z.number().int().min(0, "Stock cannot be negative.").optional(),
  minOrderQuantity: z.number().int().min(1, "Minimum order quantity must be at least 1.").optional(),
  maxOrderQuantity: z.number().int().min(1, "Maximum order quantity must be at least 1.").optional(),
  isActive: z.boolean().optional(), // Admin can activate/deactivate
  // Add other fields admin can update, e.g., imageUrl (handled by file upload), sellerId (careful with this)
}).partial(); // All fields are optional for a PATCH request

// --- Routes ---

/**
 * ✅ GET /api/admin/products - सभी प्रोडक्ट्स फ़ेच करें (पेंडिंग, अप्रूव्ड, रिजेक्टेड)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminProductsRouter.get('/', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allProducts = await db.query.products.findMany({
      with: {
        seller: {
          columns: { id: true, businessName: true }
        },
        category: {
          columns: { id: true, name: true }
        }
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
    return res.status(200).json(allProducts);
  } catch (error: any) {
    console.error('❌ Error fetching all products for admin:', error);
    return res.status(500).json({ error: 'Failed to fetch all products.' });
  }
});


/**
 * ✅ GET /api/admin/products/pending
 * सभी लंबित (pending) प्रोडक्ट्स को फ़ेच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminProductsRouter.get('/pending', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pendingProducts = await db.query.products.findMany({
      where: eq(products.approvalStatus, approvalStatusEnum.enumValues[0]), // 'pending'
      with: {
        seller: { columns: { id: true, businessName: true } },
        category: { columns: { id: true, name: true } }
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
    res.status(200).json(pendingProducts);
  } catch (error: any) {
    console.error('Failed to fetch pending products:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * ✅ GET /api/admin/products/approved
 * सभी स्वीकृत (approved) प्रोडक्ट्स को फ़eच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminProductsRouter.get('/approved', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const approvedProducts = await db.query.products.findMany({
      where: eq(products.approvalStatus, approvalStatusEnum.enumValues[1]), // 'approved'
      with: {
        seller: { columns: { id: true, businessName: true } },
        category: { columns: { id: true, name: true } }
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
    res.status(200).json(approvedProducts);
  } catch (error: any) {
    console.error('Failed to fetch approved products:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * ✅ GET /api/admin/products/:id
 * ID द्वारा एकल प्रोडक्ट फ़ेच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminProductsRouter.get('/:id', authorize(['admin']), validateRequest(productIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const productId = parseInt(req.params.id);
    const [product] = await db.query.products.findMany({
      where: eq(products.id, productId),
      with: {
        seller: { columns: { id: true, businessName: true } },
        category: { columns: { id: true, name: true } }
      }
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }
    return res.status(200).json(product);
  } catch (error: any) {
    console.error(`❌ Error fetching product with ID ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to fetch product.' });
  }
});

/**
 * ✅ PATCH /api/admin/products/approve/:id
 * एक प्रोडक्ट को मंज़ूर करें (मौजूदा लॉजिक का उपयोग करें)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminProductsRouter.patch('/approve/:id', authorize(['admin']), validateRequest(productIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const productId = Number(req.params.id);

    const [approved] = await db
      .update(products)
      .set({ approvalStatus: approvalStatusEnum.enumValues[1], updatedAt: new Date() }) // 'approved'
      .where(eq(products.id, productId))
      .returning();

    if (!approved) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Socket.io event for seller
    // getIO().emit(`seller:${approved.sellerId}:product-update`, {
    //   productId: approved.id,
    //   status: 'approved',
    //   message: `Your product '${approved.name}' has been approved by admin.`,
    // });

    res.status(200).json({
      message: 'Product approved successfully.',
      product: approved,
    });
  } catch (error: any) {
    console.error('Failed to approve product:', error);
    res.status(500).json({ message: 'Failed to approve product.' });
  }
});

/**
 * ✅ PATCH /api/admin/products/reject/:id
 * एक प्रोडक्ट को अस्वीकार करें (मौजूदा लॉजिक का उपयोग करें और कारण स्वीकार करें)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminProductsRouter.patch('/reject/:id', authorize(['admin']), validateRequest(productIdSchema.extend({
  body: z.object({
    reason: z.string().min(1, "Rejection reason is required for rejecting a product.").optional(), // Optional, but highly recommended
  }).partial(),
})), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const productId = Number(req.params.id);
    const { reason } = req.body;

    const [rejected] = await db
      .update(products)
      .set({
        approvalStatus: approvalStatusEnum.enumValues[2], // 'rejected'
        rejectionReason: reason || null, // Allow admin to provide a reason
        updatedAt: new Date()
      })
      .where(eq(products.id, productId))
      .returning();

    if (!rejected) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    // Socket.io event for seller
    // getIO().emit(`seller:${rejected.sellerId}:product-update`, {
    //   productId: rejected.id,
    //   status: 'rejected',
    //   message: `Your product '${rejected.name}' has been rejected by admin. Reason: ${reason || 'No reason provided.'}`,
    // });

    res.status(200).json({
      message: 'Product rejected successfully.',
      product: rejected,
    });
  } catch (error: any) {
    console.error('Failed to reject product:', error);
    res.status(500).json({ message: 'Failed to reject product.' });
  }
});


/**
 * ✅ PATCH /api/admin/products/:id
 * एक मौजूदा प्रोडक्ट के विवरण को अपडेट करें (एडमिन द्वारा)
 * इसमें मूल्य, स्टॉक, सक्रिय स्थिति, श्रेणी, आदि शामिल हैं।
 * (Authorization handled by `authorize(['admin'])`)
 */
adminProductsRouter.patch(
  '/:id',
  authorize(['admin']),
  upload.single('image'), // उत्पाद छवि अपडेट के लिए
  validateRequest(productIdSchema.extend({
    body: productUpdateBodySchema.extend({
      isActive: z.union([z.boolean(), z.string().transform(val => val === 'true')]).optional(),
      category: z.union([z.number().int(), z.string().transform(val => parseInt(val))]).optional(), // categoryId for validation
      price: z.union([z.string(), z.number().transform(val => String(val))]).optional(),
      stock: z.union([z.number().int(), z.string().transform(val => parseInt(val))]).optional(),
      minOrderQuantity: z.union([z.number().int(), z.string().transform(val => parseInt(val))]).optional(),
      maxOrderQuantity: z.union([z.number().int(), z.string().transform(val => parseInt(val))]).optional(),
    }).partial(),
  })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const productId = parseInt(req.params.id);
      const updateData = req.body;
      const file = req.file;

      if (isNaN(productId)) {
        return res.status(400).json({ error: 'Invalid product ID.' });
      }

      const [existingProduct] = await db.query.products.findMany({ where: eq(products.id, productId) });
      if (!existingProduct) {
        return res.status(404).json({ message: 'Product not found.' });
      }

      let imageUrl = existingProduct.image;
      if (file) {
        imageUrl = await uploadImage(file.path, `products/${existingProduct.sellerId}/${uuidv4()}-${file.originalname}`); // ✅ Seller-specific image path
        if (!imageUrl) {
          return res.status(500).json({ error: 'Failed to upload new product image.' });
        }
      }

      // Convert category ID string to number if present
      if (updateData.category) {
        updateData.categoryId = parseInt(updateData.category);
        delete updateData.category; // Remove the original string category field
      }

      const finalUpdateData: Partial<typeof products.$inferInsert> = {
        ...updateData,
        image: imageUrl,
        updatedAt: new Date(),
      };

      // Remove undefined values to avoid setting fields to undefined in DB
      Object.keys(finalUpdateData).forEach(key => finalUpdateData[key as keyof typeof finalUpdateData] === undefined && delete finalUpdateData[key as keyof typeof finalUpdateData]);


      const [updatedProduct] = await db.update(products)
        .set(finalUpdateData)
        .where(eq(products.id, productId))
        .returning();

      if (!updatedProduct) {
        return res.status(500).json({ message: 'Failed to update product.' });
      }

      // Socket.io event for seller
      // getIO().emit(`seller:${updatedProduct.sellerId}:product-update`, {
      //   productId: updatedProduct.id,
      //   message: `Your product '${updatedProduct.name}' has been updated by admin.`,
      //   product: updatedProduct
      // });

      return res.status(200).json({ message: "Product updated successfully.", product: updatedProduct });
    } catch (error: any) {
      console.error(`❌ Error updating product with ID ${req.params.id}:`, error);
      return res.status(500).json({ error: error.message || 'Failed to update product.' });
    }
  }
);


/**
 * ✅ DELETE /api/admin/products/:id
 * एक प्रोडक्ट को हटाएं (एडमिन द्वारा)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminProductsRouter.delete('/:id', authorize(['admin']), validateRequest(productIdSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const productId = parseInt(req.params.id);

    const [deletedProduct] = await db.delete(products)
      .where(eq(products.id, productId))
      .returning();

    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found." });
    }

    // TODO: यदि इस प्रोडक्ट से संबंधित कोई ऑर्डर आइटम हैं, तो उन्हें कैसे हैंडल किया जाए?
    // या तो डिलीट होने से रोकें, या ऑर्डर आइटम से लिंक हटा दें, या कैस्केड डिलीट करें।
    // अभी के लिए, यह मान रहा है कि डिलीट ठीक है या DB cascading handles it.

    // Socket.io event for seller
    // getIO().emit(`seller:${deletedProduct.sellerId}:product-deleted`, {
    //   productId: deletedProduct.id,
    //   message: `Your product '${deletedProduct.name}' has been deleted by admin.`,
    // });


    return res.status(200).json({ message: "Product deleted successfully.", product: deletedProduct });
  } catch (error: any) {
    console.error(`❌ Error deleting product with ID ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to delete product.' });
  }
});

// Export router
export default adminProductsRouter;
                 
