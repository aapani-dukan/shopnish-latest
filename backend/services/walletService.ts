import { db } from '../server/db'; // आपका DB कनेक्शन
import { wallets, walletTransactions } from '../shared/backend/schema';
import { eq, and, sql } from 'drizzle-orm';

export const WalletService = {
  
  /**
   * 💰 पैसे क्रेडिट करने का मास्टर फंक्शन (Internal Use)
   */
  /**
   * 💰 पैसे क्रेडिट करने का मास्टर फंक्शन
   * @param externalTx - (Optional) अगर हम इसे किसी और ट्रांजेक्शन के अंदर चला रहे हैं
   */
  async addMoney(
    userId: number, 
    userType: 'seller' | 'delivery-boy', 
    amount: number, 
    purpose: string, 
    referenceId: string, 
    description: string,
    externalTx?: any // 👈 यह नया पैरामीटर है
  ) {
    // अगर बाहर से tx आ रहा है तो उसे यूज़ करो, वरना db.transaction बनाओ
    const transactionManager = externalTx || db;

    const logic = async (tx: any) => {
      // 1. वॉलेट ढूंढें या अगर नहीं है तो बनाएं
      let [wallet] = await tx.select().from(wallets).where(
        and(eq(wallets.userId, userId), eq(wallets.userType, userType))
      );

      if (!wallet) {
        [wallet] = await tx.insert(wallets).values({
          userId,
          userType,
          balance: 0,
        }).returning();
      }

      const newBalance = (wallet.balance || 0) + amount;

      // 2. वॉलेट बैलेंस अपडेट करें
      await tx.update(wallets)
        .set({ 
          balance: newBalance,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      // 3. ट्रांजेक्शन हिस्ट्री में रिकॉर्ड डालें
      await tx.insert(walletTransactions).values({
        walletId: wallet.id,
        amount,
        type: 'credit',
        purpose,
        referenceId,
        closingBalance: newBalance,
        description,
        status: 'completed'
      });

      return { success: true, newBalance };
    };

    // अगर externalTx मौजूद है, तो सीधे लॉजिक चलाओ, वरना ट्रांजेक्शन रैपर में चलाओ
    return externalTx ? logic(externalTx) : await db.transaction(logic);
  },
  /**
   * 🚚 डिलीवरी बॉय की कमाई क्रेडिट करें
   */
  async creditDeliveryBoyEarnings(deliveryBoyId: number, userId: number, batchId: number, fee: number) {
    return await this.addMoney(
      userId, 
      'delivery-boy', 
      fee, 
      'delivery_fee', 
      `batch_${batchId}`, 
      `Earnings for delivery batch #${batchId}`
    );
  },

  /**
   * 🏪 सेलर की कमाई क्रेडिट करें (कमीशन काटकर)
   */
  async creditSellerEarnings(sellerId: number, userId: number, orderId: number, totalAmount: number, commissionRate: number) {
    const commission = (totalAmount * commissionRate) / 100;
    const finalEarnings = totalAmount - commission;

    return await this.addMoney(
      userId, 
      'seller', 
      finalEarnings, 
      'order_earning', 
      `order_${orderId}`, 
      `Earnings for Order #${orderId} (Commission ${commissionRate}% deducted)`
    );
  }
};