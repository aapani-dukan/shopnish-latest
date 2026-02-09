import { Router,Request,Response } from 'express';
import { db } from '../server/db';
import { wallets, walletTransactions,users } from '../shared/backend/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../server/middleware/authMiddleware'; // आपका Auth Middleware
import { WalletService } from '../services/walletService'; // अपना सही पाथ दें
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
    const history = await db.select().from(walletTransactions)
      .where(eq(walletTransactions.walletId, wallet.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(10);

    // 3. रिस्पॉन्स भेजें
    res.json({
      balance: Number(wallet.balance),
      currency: "INR",
      lastUpdated: wallet.updatedAt,
      transactions: history.map(t => ({
        id: t.id,
        amount: Number(t.amount),
        type: t.type, // 'credit' or 'debit'
        purpose: t.purpose, // 'order_earning', 'delivery_fee', etc.
        description: t.description,
        status: t.status,
        date: t.createdAt
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
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Access Denied' });

  const { targetUserId, amount, note } = req.body; 

  try {
    await db.transaction(async (tx) => {
      // वॉलेट में पैसा वापस जोड़ना (Negative balance को 0 की तरफ लाना)
      await WalletService.addMoney(
        targetUserId,
        'delivery-boy',
        Number(amount), // जितना कैश उसने जमा किया
        'settlement',
        `settle_${Date.now()}`,
        note || 'Cash settlement by admin',
        tx
      );
    });

    res.json({ message: 'Cash settlement successful' });
  } catch (error) {
    res.status(500).json({ error: 'Settlement failed' });
  }
});
// GET: /api/wallet/my-wallet
// यह रूट सेलर और डिलीवरी बॉय दोनों के लिए काम करेगा
router.get('/my-wallet', requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const userType = req.user.role; // 'seller' या 'delivery-boy'

  try {
    // 1. वॉलेट बैलेंस निकालें
    const [userWallet] = await db.select()
      .from(wallets)
      .where(
        and(eq(wallets.userId, userId), eq(wallets.userType, userType))
      );

    if (!userWallet) {
      return res.json({ balance: 0, transactions: [] });
    }

    // 2. ताज़ा 10 ट्रांजैक्शन निकालें
    const history = await db.select()
      .from(walletTransactions)
      .where(eq(walletTransactions.walletId, userWallet.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(10);

    res.json({
      balance: userWallet.balance,
      transactions: history
    });

  } catch (error) {
    console.error("Wallet Fetch Error:", error);
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
});
export default router;