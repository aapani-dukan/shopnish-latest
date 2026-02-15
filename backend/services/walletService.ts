import { db } from '../server/db';
import { wallets, walletTransactions } from '../shared/backend/schema';
import { eq, and, desc } from 'drizzle-orm';

export const WalletService = {
  
  /**
   * 💰 MASTER FUNCTION: Direct Balance Update
   * Use for: Payouts, Delivery Boy Earnings, Admin Adjustments
   */
  async addMoney(
    userId: number, 
    userType: 'seller' | 'delivery-boy', 
    amount: number, 
    purpose: string, 
    referenceId: string, 
    description: string,
    externalTx?: any
  ) {
    const logic = async (tx: any) => {
      // 1. Wallet dhundein ya banayein
      let [wallet] = await tx.select().from(wallets).where(
        and(eq(wallets.userId, userId), eq(wallets.userType, userType))
      );

      if (!wallet) {
        [wallet] = await tx.insert(wallets).values({
          userId,
          userType,
          balance: 0,
          pendingAmount: 0
        }).returning();
      }

      const newBalance = (Number(wallet.balance) || 0) + amount;

      // 2. Main Balance update karein
      await tx.update(wallets)
        .set({ 
          balance: newBalance,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      // 3. Transaction History (Status: Completed)
      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        amount,
        type: amount > 0 ? 'credit' : 'debit',
        purpose,
        referenceId,
        closingBalance: newBalance,
        description,
        status: 'completed'
      });

      return { success: true, newBalance };
    };

    return externalTx ? logic(externalTx) : await db.transaction(logic);
  },

  /**
   * ⏳ PENDING MONEY: Temporary Hold Logic
   * Use for: Seller Order Earnings (Holding period for returns)
   */
  async addPendingMoney(
    userId: number, 
    userType: 'seller', 
    amount: number, 
    purpose: string, 
    referenceId: string, 
    description: string,
    externalTx?: any
  ) {
    const logic = async (tx: any) => {
      let [wallet] = await tx.select().from(wallets).where(
        and(eq(wallets.userId, userId), eq(wallets.userType, userType))
      );

      if (!wallet) {
        [wallet] = await tx.insert(wallets).values({ 
          userId, 
          userType, 
          balance: 0, 
          pendingAmount: 0 
        }).returning();
      }

      // Main Balance ko nahi, Pending Amount ko badhayein
      const newPending = (Number(wallet.pendingAmount) || 0) + amount;

      await tx.update(wallets)
        .set({ 
          pendingAmount: newPending,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      // Transaction Record (Status: Pending)
      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        amount,
        type: 'credit',
        purpose,
        referenceId,
        closingBalance: Number(wallet.balance), // Balance wahi rahega
        description: description + " (Pending Verification)",
        status: 'pending' 
      });

      return { success: true, pendingAmount: newPending };
    };

    return externalTx ? logic(externalTx) : await db.transaction(logic);
  },

  /**
   * 🏪 SELLER EARNINGS: Commission kaat kar pending mein dalna
   */
  async creditSellerEarnings(userId: number, orderId: number, totalAmount: number, commissionRate: number) {
    const commission = (totalAmount * commissionRate) / 100;
    const finalEarnings = totalAmount - commission;

    return await this.addPendingMoney(
      userId, 
      'seller', 
      finalEarnings, 
      'order_earning', 
      `order_${orderId}`, 
      `Earnings for Order #${orderId} (${commissionRate}% commission deducted)`
    );
  },

  /**
   * 🚚 DELIVERY BOY EARNINGS: Direct credit
   */
  async creditDeliveryBoyEarnings(userId: number, batchId: number, fee: number) {
    return await this.addMoney(
      userId, 
      'delivery-boy', 
      fee, 
      'delivery_fee', 
      `batch_${batchId}`, 
      `Earnings for delivery batch #${batchId}`
    );
  }
};