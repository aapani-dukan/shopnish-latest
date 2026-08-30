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
    userType: 'seller' | 'delivery-boy' | 'admin', 
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
          codBalance: 0,
          pendingAmount: 0
        }).returning();
      }

      const currentBalance = Number(wallet.balance) || 0;
const newBalance = currentBalance + amount;

// Debit के कारण wallet negative नहीं होना चाहिए
if (amount < 0 && Math.abs(amount) > currentBalance) {
  throw new Error(
    `Insufficient wallet balance. Available: ₹${currentBalance.toFixed(2)}`
  );
}

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

  
async creditSellerEarnings(
  userId: number,
  orderId: number,
  orderItems: Array<{
    sellerProductId: number,
    quantity: number,
    price: number
  }>,
  adminUserId: number,
  externalTx?: any
) {
  const tx = externalTx || db;

  let totalFinalEarnings = 0;
  let totalCommissionDeducted = 0;

  for (const item of orderItems) {

    const itemTotalAmount =
      Number(item.price) * (item.quantity || 1);

    // 1️⃣ Product की जानकारी
    const [productData] = await tx
      .select({
        id: products.id,
        masterProductId: products.masterProductId,
        sellerBrandType: products.brandType,
        sellerSubCategoryId: products.subCategoryId,
      })
      .from(products)
      .where(eq(products.id, item.sellerProductId));

    const finalBrandType =
      productData?.sellerBrandType || "LOCAL";

    // Default commission
    let commissionRate =
      finalBrandType === "BRANDED" ? 3.00 : 12.00;


    // 2️⃣ Master Product → Subcategory commission
    if (productData?.masterProductId) {

      const [mappedSubCategory] = await tx
        .select({
          fmcgBrandCommission:
            subcategories.fmcgBrandCommission,

          localBrandCommission:
            subcategories.localBrandCommission
        })
        .from(productSubcategories)
        .leftJoin(
          subcategories,
          eq(
            productSubcategories.subCategoryId,
            subcategories.id
          )
        )
        .where(
          eq(
            productSubcategories.masterProductId,
            productData.masterProductId
          )
        )
        .limit(1);


      if (!mappedSubCategory) {
        throw new Error(
          `[CRITICAL FINANCE ERROR]: Master Product ID #${productData.masterProductId} किसी भी Subcategory से mapped नहीं है!`
        );
      }

      if (
        !mappedSubCategory.fmcgBrandCommission ||
        !mappedSubCategory.localBrandCommission
      ) {
        throw new Error(
          `[CRITICAL FINANCE ERROR]: Subcategory का commission rate खाली है!`
        );
      }


      commissionRate =
        finalBrandType === "BRANDED"
          ? parseFloat(
              mappedSubCategory.fmcgBrandCommission
            )
          : parseFloat(
              mappedSubCategory.localBrandCommission
            );
    }


    // 3️⃣ Manual Product → Direct Subcategory
    else if (productData?.sellerSubCategoryId) {

      const [subCat] = await tx
        .select()
        .from(subcategories)
        .where(
          eq(
            subcategories.id,
            productData.sellerSubCategoryId
          )
        );


      if (!subCat) {
        throw new Error(
          `[CRITICAL FINANCE ERROR]: Subcategory ID #${productData.sellerSubCategoryId} database में नहीं मिली!`
        );
      }

      if (
        !subCat.fmcgBrandCommission ||
        !subCat.localBrandCommission
      ) {
        throw new Error(
          `[CRITICAL FINANCE ERROR]: Subcategory ID #${subCat.id} का commission rate खाली है!`
        );
      }


      commissionRate =
        finalBrandType === "BRANDED"
          ? parseFloat(subCat.fmcgBrandCommission)
          : parseFloat(subCat.localBrandCommission);
    }


    // 4️⃣ Commission calculation
    const itemCommission =
      (itemTotalAmount * commissionRate) / 100;

    const itemEarnings =
      itemTotalAmount - itemCommission;


    totalFinalEarnings += itemEarnings;
    totalCommissionDeducted += itemCommission;
  }


  // पैसे को 2 decimal तक round करें
  const finalSellerEarnings =
    Math.round(totalFinalEarnings * 100) / 100;

  const finalCommission =
    Math.round(totalCommissionDeducted * 100) / 100;


  // 5️⃣ Seller को commission काटकर Pending में डालो
  const sellerResult =
    await this.addMoney(
      userId,
      'seller',
      finalSellerEarnings,
      'order_earning',
      `order_${orderId}`,
      `Order #${orderId} Earnings. Product Value: ₹${(
        finalSellerEarnings + finalCommission
      ).toFixed(2)} | Commission: ₹${finalCommission.toFixed(2)}`,
      tx
    );


  // 6️⃣ Commission Admin Wallet में डालो
  if (finalCommission > 0) {

    await this.addMoney(
      adminUserId,
      'admin',
      finalCommission,
      'seller_commission',
      `order_${orderId}`,
      `Seller commission from Order #${orderId}`,
      tx
    );
  }


  return {
    success: true,
    sellerEarnings: finalSellerEarnings,
    commission: finalCommission,
    sellerResult
  };
},
async releaseSellerPending(
  sellerUserId: number,
  amount: number,
  adminUserId: number,
  referenceId: string,
  description: string
) {
  const logic = async (tx: any) => {

    // 1. Seller wallet खोजें
    const [sellerWallet] = await tx
      .select()
      .from(wallets)
      .where(
        and(
          eq(wallets.userId, sellerUserId),
          eq(wallets.userType, 'seller')
        )
      );

    if (!sellerWallet) {
      throw new Error('Seller wallet not found');
    }

    const currentPending =
      Number(sellerWallet.pendingAmount) || 0;

    const releaseAmount = Number(amount);

    // 2. Security checks
    if (!Number.isFinite(releaseAmount) || releaseAmount <= 0) {
      throw new Error('Invalid release amount');
    }

    if (releaseAmount > currentPending) {
      throw new Error(
        `Release amount ₹${releaseAmount.toFixed(2)} is greater than pending amount ₹${currentPending.toFixed(2)}`
      );
    }

    const currentBalance =
      Number(sellerWallet.balance) || 0;

    const newPending =
      currentPending - releaseAmount;

    const newBalance =
      currentBalance + releaseAmount;

    // 3. Pending कम + Main Balance बढ़ाएं
    await tx
      .update(wallets)
      .set({
        balance: newBalance,
        pendingAmount: newPending,
        updatedAt: new Date()
      })
      .where(eq(wallets.id, sellerWallet.id));

    // 4. Seller transaction
    await tx.insert(walletTransactions).values({
      walletId: sellerWallet.id,
      amount: releaseAmount,
      type: 'credit',
      purpose: 'pending_release',
      referenceId,
      closingBalance: newBalance,
      description,
      status: 'completed'
    });

    return {
      success: true,
      releasedAmount: releaseAmount,
      sellerBalance: newBalance,
      sellerPendingAmount: newPending
    };
  };

  return await db.transaction(logic);
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
  },
  async creditDeliveryBoyCOD(
  userId: number,
  batchId: number,
  codAmount: number
) {
  const logic = async (tx: any) => {

    let [wallet] = await tx.select().from(wallets).where(
      and(
        eq(wallets.userId, userId),
        eq(wallets.userType, 'delivery-boy')
      )
    );

    if (!wallet) {
      [wallet] = await tx.insert(wallets).values({
        userId,
        userType: 'delivery-boy',
        balance: 0,
        codBalance: 0,
        pendingAmount: 0
      }).returning();
    }

    const newCodBalance =
      (Number(wallet.codBalance) || 0) + Number(codAmount);

    await tx.update(wallets)
      .set({
        codBalance: newCodBalance,
        updatedAt: new Date()
      })
      .where(eq(wallets.id, wallet.id));

    await tx.insert(walletTransactions).values({
      walletId: wallet.id,
      amount: Number(codAmount),
      type: 'credit',
      purpose: 'cod_collection',
      referenceId: `batch_${batchId}`,
      closingBalance: newCodBalance,
      description:
        `COD collected from customer for delivery batch #${batchId}`,
      status: 'completed'
    });

    return {
      success: true,
      codBalance: newCodBalance
    };
  };

  return await db.transaction(logic);
},
async settleDeliveryBoyCOD(
  deliveryBoyId: number,
  amount: number,
  adminUserId: number,
  referenceId: string,
  description: string
) {
  const logic = async (tx: any) => {
    // 1. Delivery Boy wallet
    const [deliveryWallet] = await tx
      .select()
      .from(wallets)
      .where(
        and(
          eq(wallets.userId, deliveryBoyId),
          eq(wallets.userType, 'delivery-boy')
        )
      );

    if (!deliveryWallet) {
      throw new Error('Delivery Boy wallet not found');
    }

    const currentCOD = Number(deliveryWallet.codBalance) || 0;
    const settlementAmount = Number(amount);

    // 2. सुरक्षा: जितना COD है उससे ज्यादा settle नहीं कर सकते
    if (settlementAmount <= 0) {
      throw new Error('Invalid settlement amount');
    }

    if (settlementAmount > currentCOD) {
      throw new Error(
        `Settlement amount ₹${settlementAmount} is greater than COD balance ₹${currentCOD}`
      );
    }

    const newCODBalance = currentCOD - settlementAmount;

    // 3. Delivery Boy का COD balance कम करें
    await tx
      .update(wallets)
      .set({
        codBalance: newCODBalance,
        updatedAt: new Date()
      })
      .where(eq(wallets.id, deliveryWallet.id));

    // 4. Delivery Boy COD transaction
    await tx.insert(walletTransactions).values({
      walletId: deliveryWallet.id,
      amount: settlementAmount,
      type: 'debit',
      purpose: 'cod_settlement',
      referenceId,
      closingBalance: newCODBalance,
      description,
      status: 'completed'
    });

    // 5. Admin wallet खोजें
    let [adminWallet] = await tx
      .select()
      .from(wallets)
      .where(
        and(
          eq(wallets.userId, adminUserId),
          eq(wallets.userType, 'admin')
        )
      );

    // 6. Admin wallet नहीं है तो बनाएं
    if (!adminWallet) {
      [adminWallet] = await tx
        .insert(wallets)
        .values({
          userId: adminUserId,
          userType: 'admin',
          balance: 0,
          codBalance: 0,
          pendingAmount: 0
        })
        .returning();
    }

    const newAdminBalance =
      (Number(adminWallet.balance) || 0) + settlementAmount;

    // 7. Admin balance बढ़ाएं
    await tx
      .update(wallets)
      .set({
        balance: newAdminBalance,
        updatedAt: new Date()
      })
      .where(eq(wallets.id, adminWallet.id));

    // 8. Admin transaction
    await tx.insert(walletTransactions).values({
      walletId: adminWallet.id,
      amount: settlementAmount,
      type: 'credit',
      purpose: 'cod_settlement',
      referenceId,
      closingBalance: newAdminBalance,
      description,
      status: 'completed'
    });

    return {
      success: true,
      settledAmount: settlementAmount,
      deliveryBoyCODBalance: newCODBalance,
      adminBalance: newAdminBalance
    };
  };

  return await db.transaction(logic);
},
async settleDeliveryBoyEarning(
  deliveryBoyId: number,
  amount: number,
  adminUserId: number,
  referenceId: string,
  description: string
) {
  const logic = async (tx: any) => {

    // 1. Delivery Boy wallet
    const [deliveryWallet] = await tx
      .select()
      .from(wallets)
      .where(
        and(
          eq(wallets.userId, deliveryBoyId),
          eq(wallets.userType, 'delivery-boy')
        )
      );

    if (!deliveryWallet) {
      throw new Error('Delivery Boy wallet not found');
    }

    const currentBalance = Number(deliveryWallet.balance) || 0;
    const settlementAmount = Number(amount);

    // 2. Security checks
    if (settlementAmount <= 0) {
      throw new Error('Invalid settlement amount');
    }

    if (settlementAmount > currentBalance) {
      throw new Error(
        `Settlement amount ₹${settlementAmount} is greater than earning balance ₹${currentBalance}`
      );
    }

    const newDeliveryBalance =
      currentBalance - settlementAmount;

    // 3. Delivery Boy earning balance कम करें
    await tx
      .update(wallets)
      .set({
        balance: newDeliveryBalance,
        updatedAt: new Date()
      })
      .where(eq(wallets.id, deliveryWallet.id));

    // 4. Delivery Boy transaction
    await tx.insert(walletTransactions).values({
      walletId: deliveryWallet.id,
      amount: settlementAmount,
      type: 'debit',
      purpose: 'earning_settlement',
      referenceId,
      closingBalance: newDeliveryBalance,
      description,
      status: 'completed'
    });

    // 5. Admin wallet खोजें
    let [adminWallet] = await tx
      .select()
      .from(wallets)
      .where(
        and(
          eq(wallets.userId, adminUserId),
          eq(wallets.userType, 'admin')
        )
      );

    // 6. Admin wallet नहीं है तो बनाएं
    if (!adminWallet) {
      [adminWallet] = await tx
        .insert(wallets)
        .values({
          userId: adminUserId,
          userType: 'admin',
          balance: 0,
          codBalance: 0,
          pendingAmount: 0
        })
        .returning();
    }

    const currentAdminBalance =
      Number(adminWallet.balance) || 0;

    const newAdminBalance =
      currentAdminBalance - settlementAmount;

    // 7. Admin balance कम करें
    await tx
      .update(wallets)
      .set({
        balance: newAdminBalance,
        updatedAt: new Date()
      })
      .where(eq(wallets.id, adminWallet.id));

    // 8. Admin transaction
    await tx.insert(walletTransactions).values({
      walletId: adminWallet.id,
      amount: settlementAmount,
      type: 'debit',
      purpose: 'delivery_earning_payout',
      referenceId,
      closingBalance: newAdminBalance,
      description:
        `Payment of delivery earning to delivery boy #${deliveryBoyId}`,
      status: 'completed'
    });

    return {
      success: true,
      settledAmount: settlementAmount,
      deliveryBoyBalance: newDeliveryBalance,
      adminBalance: newAdminBalance
    };
  };

  return await db.transaction(logic);
},

};