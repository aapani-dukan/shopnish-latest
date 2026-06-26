import { db } from "../server/db";
import { productAffinity,productViews } from "../shared/backend/schema";
import { and, eq, sql } from "drizzle-orm";

type EventType = "view" | "cart" | "wishlist" | "order";

const weightMap: Record<EventType, number> = {
  view: 1,
  cart: 5,
  wishlist: 3,
  order: 10,
};

export const trackProductEvent = async ({
  userId,
  productId,
  type,
}: {
  userId: number;
  productId: number;
  type: EventType;
}) => {
  const weight = weightMap[type] || 1;
if (type === "view") {
  await db.insert(productViews).values({
    userId,
    productId,
  });
}
  const existing = await db
    .select()
    .from(productAffinity)
    .where(
      and(
        eq(productAffinity.userId, userId),
        eq(productAffinity.productId, productId)
      )
    )
    .limit(1);

  // =========================
  // UPDATE EXISTING
  // =========================
  if (existing.length) {
    await db
      .update(productAffinity)
      .set({
        score: sql`${productAffinity.score} + ${weight}`,
        lastInteraction: new Date(),
      })
      .where(
        and(
          eq(productAffinity.userId, userId),
          eq(productAffinity.productId, productId)
        )
      );

    return;
  }

  // =========================
  // INSERT NEW
  // =========================
  await db.insert(productAffinity).values({
    userId,
    productId,
    score: weight,
    lastInteraction: new Date(),
  });
};
const getDecayFactor = (lastInteraction: Date) => {
  const now = new Date();

  const diffHours =
    (now.getTime() - new Date(lastInteraction).getTime()) /
    (1000 * 60 * 60);

  // 🔥 decay curve (smooth forgetting)
  const decay = Math.exp(-0.05 * diffHours);

  return decay; // 1 = fresh, 0 = old
};
export const getUserProductScores = async (userId: number) => {
  const rows = await db
    .select()
    .from(productAffinity)
    .where(eq(productAffinity.userId, userId));

  const scored = rows.map((item) => {
    const decay = getDecayFactor(item.lastInteraction);
const safeScore = Number(item.score ?? 0);
    return {
      productId: item.productId,
      score:  safeScore* decay,
    };
  });

  return scored;
};
const applyBoost = (score: number, lastInteraction: Date) => {
  const hours =
    (Date.now() - new Date(lastInteraction).getTime()) /
    (1000 * 60 * 60);

  // 🔥 recent boost
  if (hours < 6) return score * 1.5;
  if (hours < 24) return score * 1.2;

  return score;
};
export const getTrendingProducts = async () => {
  const since = new Date();

  since.setDate(since.getDate() - 7);

  const rows = await db
    .select({
      productId: productViews.productId,
      count: sql<number>`count(*)`,
    })
    .from(productViews)
    .where(sql`${productViews.viewedAt} >= ${since}`)
    .groupBy(productViews.productId);

  return rows;
};