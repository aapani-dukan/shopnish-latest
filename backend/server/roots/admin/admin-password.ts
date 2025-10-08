// server/roots/admin/admin-password.ts
import { Router, Response } from 'express';
import { db } from '../../db.js'; // Correct relative path
import { users, userRoleEnum } from '../../../shared/backend/schema.ts';
import { eq } from 'drizzle-orm';
import { AuthenticatedRequest } from '../../middleware/verifyToken.ts';
import { requireAuth } from '../../middleware/authMiddleware.ts'; // This might need to be requireAdminAuth

const router = Router();

// Example route (adjust as per your actual implementation)
router.get('/admin/users/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID.' });
    }

    try {
        const [user] = await db.select().from(users).where(eq(users.id, userId)); // Destructure to get the first element
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Now you can safely access user.role
        if (user.role !== userRoleEnum.enumValues[2]) { // Assuming 'admin' is enum index 2
            return res.status(403).json({ error: 'Not an admin user.' });
        }

        res.status(200).json(user);
    } catch (error: any) {
        console.error('Failed to fetch admin user:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

export default router;
