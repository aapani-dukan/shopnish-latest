import { Router, Response, NextFunction } from 'express';
import { db } from '../server/db';
import { categories, users, userRoleEnum, orders, orderItems, products, deliveryBoys, sellers } from '../shared/backend/schema';
import { eq, and } from 'drizzle-orm';
import multer from 'multer';
import { uploadImage } from '../server/cloudStorage';
import { AuthenticatedRequest } from '../server/middleware/verifyToken';
import { v4 as uuidv4 } from "uuid";

const adminRouter = Router();
const upload = multer({ dest: 'uploads/' });

/**
 * ✅ adminAuthMiddleware (केवल एडमिन के लिए रूट सुरक्षित करने के लिए)
 */
const adminAuthMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }
  next();
};

/**
 * ✅ GET /api/admin/me
 */
adminRouter.get('/me', adminAuthMiddleware, (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({ message: 'Welcome, Admin!', user: req.user });
});

/**
 * ✅ GET /api/admin/categories
 */
adminRouter.get('/categories', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allCategories = await db.query.categories.findMany();
    return res.status(200).json(allCategories);
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    return res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

/**
 * ✅ POST /api/admin/categories
 */
adminRouter.post('/categories', adminAuthMiddleware, upload.single('image'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, nameHindi, slug, description, isActive, sortOrder } = req.body;
    const file = req.file;

    if (!name || !slug || !file) {
      return res.status(400).json({ error: 'Missing required fields: name, slug, or image.' });
    }

    const [existingCategory] = await db.select().from(categories).where(eq(categories.slug, slug));
    if (existingCategory) {
      return res.status(409).json({ error: 'A category with this slug already exists.' });
    }
    
    const imageUrl = await uploadImage(file.path, file.originalname);

    const newCategoryData = {
      name,
      nameHindi: nameHindi || null,
      slug,
      image: imageUrl,
      description: description || null,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      sortOrder: sortOrder ? parseInt(String(sortOrder)) : 0,
    };

    const newCategory = await db.insert(categories).values(newCategoryData).returning();

    return res.status(201).json(newCategory[0]);

  } catch (error: any) {
    console.error('❌ Error in POST /api/admin/categories:', error);
    return res.status(500).json({ error: 'Failed to create new category.' });
  }
});

/**
 * ✅ GET /api/admin/orders
 * सभी orders fetch करने के लिए (admin के लिए)
 */
adminRouter.get('/orders', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allOrders = await db.query.orders.findMany({
      with: {
        items: {
          with: {
            product: true,
          },
        },
        user: true,
        seller: true,
        deliveryBoy: true,
        deliveryAddress: true,
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
    });

    return res.status(200).json({ orders: allOrders });
  } catch (error) {
    console.error('❌ Error fetching admin orders:', error);
    return res.status(500).json({ error: 'Failed to fetch admin orders.' });
  }
});

export default adminRouter;
