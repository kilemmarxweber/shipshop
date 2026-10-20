import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { ensureMembership } from "../src/lib/system-org";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const PASSWORD = "demo12345";

async function ensureLogin(userId: string, passwordHash: string) {
  const credential = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
  });
  if (!credential) {
    await prisma.account.create({
      data: {
        userId,
        accountId: userId,
        providerId: "credential",
        password: passwordHash,
      },
    });
  } else {
    await prisma.account.update({
      where: { id: credential.id },
      data: { accountId: userId, password: passwordHash },
    });
  }
  await ensureMembership(userId);
}

async function main() {
  const order = await prisma.order.findUnique({
    where: { id: "cmvfxi1p50004cgvrbh1bc227" },
    include: {
      shop: { include: { owner: { select: { id: true, email: true, name: true } } } },
      courier: { include: { user: { select: { id: true, email: true, name: true } } } },
    },
  });
  if (!order) throw new Error("Commande test introuvable");

  const vendor = order.shop.owner;
  let courierUser = order.courier?.user ?? null;
  if (!courierUser && order.courier) {
    courierUser = await prisma.user.upsert({
      where: { email: "livreur@chipshop.cd" },
      create: {
        name: order.courier.name,
        email: "livreur@chipshop.cd",
        emailVerified: true,
        phone: order.courier.phone,
      },
      update: {},
    });
    await prisma.courier.update({
      where: { id: order.courier.id },
      data: { userId: courierUser.id },
    });
  }
  if (!vendor) throw new Error("Vendeur sans ownerUserId");
  if (!courierUser) throw new Error("Livreur sans compte user");

  const hash = await hashPassword(PASSWORD);
  await ensureLogin(vendor.id, hash);
  await ensureLogin(courierUser.id, hash);

  console.log(
    JSON.stringify(
      {
        vendor: { name: vendor.name, email: vendor.email, password: PASSWORD },
        courier: {
          name: courierUser.name,
          email: courierUser.email,
          password: PASSWORD,
        },
        shop: order.shop.name,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
