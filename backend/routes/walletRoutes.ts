import { Router,Request,Response } from 'express';
import { db } from '../server/db';
import { wallets, walletTransactions,users } from '../shared/backend/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../server/middleware/authMiddleware'; // आपका Auth Middleware
import { WalletService } from '../services/walletService'; // अपना सही पाथ दें
import { error } from 'node:console';
const router = Router();

// ✅ वॉलेट बैलेंस और ट्रांजैक्शन हिस्ट्री देखने की API
router.get('/my-wallet', requireAuth, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role; // 'seller' या 'delivery-boy'

    // 1. वॉलेट की जानकारी निकालें
    let [wallet] = await db.select().from(wallets).where(
      and(
        eq(wallets.userId, userId),
        eq(wallets.userType, userRole as any)
      )
    );

    // अगर वॉलेट अभी तक नहीं बना (नया यूजर), तो 0 बैलेंस दिखाएं
    if (!wallet) {
      return res.json({
        balance: 0,
        currency: "INR",
        transactions: []
      });
    }

    // 2. पिछली 10 ट्रांजैक्शन निकालें (Latest first)
    // 2. ट्रांजैक्शन हिस्ट्री निकालें
    const history = await db.select().from(walletTransactions)
      .where(eq(walletTransactions.walletId, wallet.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(15); // थोडा ज्यादा डेटा ताकि स्क्रीन भरी दिखे

    // 3. रिस्पॉन्स भेजें (Frontend के लिए एकदम रेडी JSON)
    res.json({
      balance: Number(wallet.balance),
      pendingAmount: Number(wallet.pendingAmount || 0), // 🔥 ये अब फ्रंटेंड में यूज़ होगा
      currency: "INR",
      lastUpdated: wallet.updatedAt,
      transactions: history.map(t => ({
        id: t.id,
        amount: Number(t.amount),
        type: t.type, 
        purpose: t.purpose,
        description: t.description,
        status: t.status,
        date: t.createdAt,
        closingBalance: Number(t.closingBalance) // ऑडिट के लिए
      }))
    });

  } catch (error) {
    console.error('Wallet Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch wallet details' });
  }
});
// 1. सभी सेलर्स और डिलीवरी बॉयज के वॉलेट देखना
router.get('/admin/all-wallets', requireAuth, async (req: any, res: Response) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Access Denied' });
try {
    const allWallets = await db.select({
      walletId: wallets.id,
      balance: wallets.balance,
      codBalance:wallets.codBalance,
      userType: wallets.userType,
      userName: users.firstName,
      userLastName: users.lastName,
      userPhone: users.phone,
      userId: users.id
    })
    .from(wallets)
    .leftJoin(users, eq(wallets.userId, users.id)); // Users के साथ जोड़ दिया ताकि नाम दिखे

    res.json(allWallets);
  
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all wallets' });
  }
});

// 2. COD Settlement (जब डिलीवरी बॉय कैश जमा कर दे)


router.post('/admin/settle-cash', requireAuth, async (req: any, res: Response) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Access Denied' });
  }

  const { targetUserId, amount, note } = req.body;

  try {
    const settlementAmount = Number(amount);

    if (!Number.isFinite(settlementAmount) || settlementAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid settlement amount'
      });
    }

    // Admin की ID
    const adminUserId = Number(req.user.id);

    const result = await WalletService.settleDeliveryBoyCOD(
      Number(targetUserId),
      settlementAmount,
      adminUserId,
      `settle_${Date.now()}`,
      note || 'COD cash settlement by admin'
    );

    res.json({
      message: 'COD settlement successful',
      ...result
    });

  } catch (error: any) {
    console.error('COD Settlement Error:', error);

    res.status(500).json({
      error: error?.message || 'Settlement failed'
    });
  }
});
router.post('/admin/settle-earning', requireAuth, async (req: any, res: Response) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Access Denied' });
  }

  const { targetUserId, amount, note } = req.body;

  const deliveryBoyId = Number(targetUserId);
  const settlementAmount = Number(amount);
   const adminUserId = Number(req.user.id);
  if (!Number.isInteger(deliveryBoyId) || deliveryBoyId <= 0) {
    return res.status(400).json({ error: 'Invalid delivery boy ID' });
  }

  if (!Number.isFinite(settlementAmount) || settlementAmount <= 0) {
    return res.status(400).json({ error: 'Invalid settlement amount' });
  }
  if (!Number.isInteger(adminUserId) || adminUserId<=0){
    return res.status(400).json({error:'Invalid admin ID'});
  }
  try {
    const result = await 
    WalletService.settleDeliveryBoyEarning(
        deliveryBoyId,
        settlementAmount,
        adminUserId,
       `earning_settlement_${Date.now()}` ,
        note || 'Delivery earning paid by admin'
      );

    return res.json({
      success: true,
      message: 'Delivery earning settlement successful',
      settlement: result
    });

  } catch (error: any) {
    console.error('Delivery Earning Settlement Error:', error);

    return res.status(400).json({
      error: error?.message || 'Earning settlement failed'
    });
  }
});
// 3. Seller Wallet Settlement
router.post('/admin/settle-seller', requireAuth, async (req: any, res: Response) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Access Denied' });
  }

  const { targetUserId, amount, note } = req.body;

  try {
    const settlementAmount = Number(amount);

    if (!Number.isFinite(settlementAmount) || settlementAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid settlement amount'
      });
    }

    const result = await WalletService.addMoney(
      Number(targetUserId),
      'seller',
      -settlementAmount,
      'payout',
      `seller_settle_${Date.now()}`,
      note || 'Seller payout by admin'
    );

    res.json({
      message: 'Seller settlement successful',
      ...result
    });

  } catch (error: any) {
    console.error('Seller Settlement Error:', error);

    res.status(500).json({
      error: error?.message || 'Seller settlement failed'
    });
  }
});
export default router;
