import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  purchaseProduct,
  releaseEscrowToSeller,
} from "../src/lib/checkout";
import { getBucketCents } from "../src/lib/wallet-buckets";
import { formatMoney } from "../src/lib/money";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

function money(cents: number, currency = "USD") {
  return formatMoney(cents, currency);
}

async function main() {
  const buyer = await prisma.user.findFirst({
    where: { email: "demo@chipshop.cd" },
    include: { wallet: true },
  });
  if (!buyer?.wallet) throw new Error("Buyer demo introuvable");

  const product = await prisma.product.findFirst({
    where: {
      status: "ACTIVE",
      quantity: { gte: 1 },
      shop: { ownerUserId: { not: null } },
    },
    include: { shop: true },
    orderBy: { createdAt: "desc" },
  });
  if (!product?.shop.ownerUserId) throw new Error("Aucun produit actif");

  let courier = await prisma.courier.findFirst({
    where: { isAvailable: true, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!courier) throw new Error("Aucun livreur");

  let courierUser = courier.userId
    ? await prisma.user.findUnique({ where: { id: courier.userId } })
    : null;
  if (!courierUser) {
    courierUser = await prisma.user.upsert({
      where: { email: "livreur@chipshop.cd" },
      create: {
        name: courier.name,
        email: "livreur@chipshop.cd",
        emailVerified: true,
        phone: courier.phone,
        wallet: { create: { balanceCents: 0, currency: "USD" } },
      },
      update: {},
    });
    courier = await prisma.courier.update({
      where: { id: courier.id },
      data: { userId: courierUser.id, email: courierUser.email },
    });
  }
  await prisma.wallet.upsert({
    where: { userId: courierUser.id },
    create: { userId: courierUser.id, balanceCents: 0, currency: "USD" },
    update: {},
  });
  await prisma.wallet.upsert({
    where: { userId: product.shop.ownerUserId },
    create: {
      userId: product.shop.ownerUserId,
      balanceCents: 0,
      currency: "USD",
    },
    update: {},
  });

  const shippingCents = 2000;
  const need = product.priceCents + shippingCents + 500;
  if ((buyer.wallet.usdCents ?? buyer.wallet.balanceCents) < need) {
    await prisma.wallet.update({
      where: { id: buyer.wallet.id },
      data: {
        usdCents: { increment: need },
        balanceCents: { increment: need },
        buyerUsdCents: { increment: need },
      },
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const purchased = await purchaseProduct(
      tx,
      buyer.id,
      product.id,
      {
        fulfillmentType: "DELIVERY",
        deliveryCity: "Kinshasa",
        deliveryCommune: "Gombe",
        deliveryQuartier: "Centre",
        deliveryAvenue: "Boulevard du 30 Juin",
        deliveryParcelle: "12",
        deliveryLat: -4.305,
        deliveryLng: 15.311,
        contactPhone: buyer.phone || "+243810000001",
      },
      { skipShippingQuote: true, shippingCents },
    );

    const orderId = purchased.order.id;
    await tx.order.update({
      where: { id: orderId },
      data: {
        courierId: courier.id,
        status: "OUT_FOR_DELIVERY",
      },
    });
    await tx.pickupReceipt.update({
      where: { orderId },
      data: { scannedAt: new Date() },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: "AWAITING_CONFIRM" },
    });

    const split = await releaseEscrowToSeller(tx, orderId);

    await tx.pickupReceipt.update({
      where: { orderId },
      data: { redeemedAt: new Date() },
    });
    const delivered = await tx.order.update({
      where: { id: orderId },
      data: { status: "DELIVERED" },
      include: {
        product: { select: { title: true, currency: true } },
        shop: { select: { name: true, ownerUserId: true } },
        courier: true,
      },
    });
    return { delivered, split };
  });

  const order = result.delivered;
  const fees = await prisma.platformFee.findMany({
    where: { orderId: order.id },
    orderBy: { kind: "asc" },
  });
  const treasury = await prisma.platformTreasury.findUnique({
    where: { id: "chipshop" },
  });
  const vendorWallet = await prisma.wallet.findUnique({
    where: { userId: product.shop.ownerUserId },
  });
  const courierWallet = await prisma.wallet.findUnique({
    where: { userId: courierUser.id },
  });
  const vendorTxn = await prisma.walletTransaction.findFirst({
    where: { reference: `ESC-${order.id.slice(0, 8)}` },
  });
  const courierTxn = await prisma.walletTransaction.findFirst({
    where: { reference: `CRR-${order.id.slice(0, 8)}` },
  });

  const currency = order.product.currency || "USD";
  const sale = fees.find((f) => f.kind === "SALE");
  const ship = fees.find((f) => f.kind === "SHIPPING");

  console.log("\n=== Test achat livré — 3 encaissements ===");
  console.log(`Commande ${order.id}`);
  console.log(`Produit : ${order.product.title} @ ${order.shop.name}`);
  console.log(
    `Brut produit ${money(order.productCents, currency)} + transport ${money(order.shippingCents, currency)}`,
  );
  console.log("\n1) Vendeur");
  console.log(
    `   Net encaisse : ${money(vendorTxn?.amountCents ?? 0, currency)} (pot Ventes ${money(getBucketCents(vendorWallet ?? {}, "VENDOR", currency), currency)})`,
  );
  console.log(`   ESCROW_RELEASE metadata:`, vendorTxn?.metadata);
  console.log("\n2) Livreur");
  console.log(
    `   Net course : ${money(courierTxn?.amountCents ?? 0, currency)} (pot Courses ${money(getBucketCents(courierWallet ?? {}, "COURIER", currency), currency)})`,
  );
  console.log(`   COURIER_PAYOUT metadata:`, courierTxn?.metadata);
  console.log("\n3) ShipShop (trésor)");
  console.log(
    `   SALE     ${sale ? money(sale.amountCents, sale.currency) : "—"}  (${sale?.amountUsdCents ?? 0} cents USD)`,
  );
  console.log(
    `   SHIPPING ${ship ? money(ship.amountCents, ship.currency) : "—"}  (${ship?.amountUsdCents ?? 0} cents USD)`,
  );
  console.log(
    `   Trésor USD ${money(treasury?.usdCents ?? 0, "USD")} · CDF ${treasury?.cdfCents ?? 0} · KW ${treasury?.kwCents ?? 0}`,
  );
  console.log("\nSplit confirm:", result.split);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
