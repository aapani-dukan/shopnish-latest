import { db } from '../server/db';
import { wallets, walletTransactions,subcategories,masterProducts,products,productSubcategories,categorySubcategories } from '../shared/backend/schema';
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
async creditSellerEarnings(userId: number, orderId: number, orderItems: Array<{ sellerProductId: number, quantity: number, price: number }>) {
    let totalFinalEarnings = 0;
    let totalCommissionDeducted = 0;

    for (const item of orderItems) {
      const itemTotalAmount = Number(item.price) * (item.quantity || 1);

      // १. पहले सेलर प्रोडक्ट से उसका ब्रांड टाइप और मास्टर प्रोडक्ट आईडी निकालो भाई
      const [productData] = await db
        .select({
          id: products.id,
          masterProductId: products.masterProductId,
          sellerBrandType: products.brandType,
          sellerSubCategoryId: products.subCategoryId, 
        })
        .from(products)
        .where(eq(products.id, item.sellerProductId));

      const finalBrandType = productData?.sellerBrandType || "LOCAL";
      let commissionRate = finalBrandType === "BRANDED" ? 3.00 : 12.00; 

      // २. अगर यह मास्टर प्रोडक्ट है, तो हमारी नई मैपिंग टेबल (product_subcategories) से रेट लाओ
      if (productData?.masterProductId) {
        const [mappedSubCategory] = await db
          .select({
            fmcgBrandCommission: subcategories.fmcgBrandCommission,
            localBrandCommission: subcategories.localBrandCommission
          })
          .from(productSubcategories)
          .leftJoin(subcategories, eq(productSubcategories.subCategoryId, subcategories.id))
          .where(eq(productSubcategories.masterProductId, productData.masterProductId))
          .limit(1);

        // 🛡️ [सख्त बिज़नेस ताला]: अगर मैपिंग नहीं मिली या रेट खाली है, तो सीधे एरर फेंको!
        if (!mappedSubCategory) {
          throw new Error(`[CRITICAL FINANCE ERROR]: मास्टर प्रोडक्ट आईडी #${productData.masterProductId} किसी भी सब-कैटेगरी से मैप नहीं है!`);
        }
        if (!mappedSubCategory.fmcgBrandCommission || !mappedSubCategory.localBrandCommission) {
          throw new Error(`[CRITICAL FINANCE ERROR]: इस प्रोडक्ट से जुड़ी सब-कैटेगरी का कमीशन रेट डेटाबेस में खाली (null) है!`);
        }

        commissionRate = finalBrandType === "BRANDED" 
          ? parseFloat(mappedSubCategory.fmcgBrandCommission) 
          : parseFloat(mappedSubCategory.localBrandCommission);

      } else if (productData?.sellerSubCategoryId) {
        // अगर सेलर ने मैनुअल ऐड किया था और सीधे सब-कैटेगरी चुनी थी
        const [subCat] = await db
          .select()
          .from(subcategories)
          .where(eq(subcategories.id, productData.sellerSubCategoryId));
        
        if (!subCat) {
          throw new Error(`[CRITICAL FINANCE ERROR]: मैनुअल प्रोडक्ट की सब-कैटेगरी आईडी #${productData.sellerSubCategoryId} डेटाबेस में गायब है!`);
        }
        if (!subCat.fmcgBrandCommission || !subCat.localBrandCommission) {
          throw new Error(`[CRITICAL FINANCE ERROR]: सब-कैटेगरी आईडी #${subCat.id} का कमीशन रेट खाली (null) है!`);
        }

        commissionRate = finalBrandType === "BRANDED" 
          ? parseFloat(subCat.fmcgBrandCommission) 
          : parseFloat(subCat.localBrandCommission);
      }

      const itemCommission = (itemTotalAmount * commissionRate) / 100;
      const itemEarnings = itemTotalAmount - itemCommission;

      totalFinalEarnings += itemEarnings;
      totalCommissionDeducted += itemCommission;
    }

    // कुल शुद्ध कमाई दुकानदार के पेंडिंग वॉलेट में जमा करो भाई साहब
    return await this.addPendingMoney(
      userId, 
      'seller', 
      Math.round(totalFinalEarnings * 100) / 100, 
      'order_earning', 
      `order_${orderId}`, 
      `Earnings for Order #${orderId}. Total Commission Deducted: ₹${totalCommissionDeducted.toFixed(2)}`
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