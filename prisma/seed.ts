import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { KINSHASA_COMMUNES } from "../src/lib/kinshasa-geo";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const CENTER = new Set([
  "Gombe",
  "Barumbu",
  "Kinshasa",
  "Lingwala",
  "Kintambo",
  "Kasa-Vubu",
  "Kalamu",
  "Ngiri-Ngiri",
  "Bandalungwa",
  "Limete",
]);

const COORDS: Record<string, { lat: number; lng: number }> = {
  Gombe: { lat: -4.305, lng: 15.311 },
  Barumbu: { lat: -4.31, lng: 15.32 },
  Kinshasa: { lat: -4.3276, lng: 15.3136 },
  Lingwala: { lat: -4.32, lng: 15.3 },
  Kintambo: { lat: -4.33, lng: 15.27 },
  "Kasa-Vubu": { lat: -4.335, lng: 15.29 },
  Kalamu: { lat: -4.34, lng: 15.3 },
  "Ngiri-Ngiri": { lat: -4.345, lng: 15.285 },
  Bandalungwa: { lat: -4.34, lng: 15.27 },
  Selembao: { lat: -4.37, lng: 15.26 },
  Bumbu: { lat: -4.36, lng: 15.28 },
  Makala: { lat: -4.365, lng: 15.295 },
  Ngaba: { lat: -4.38, lng: 15.31 },
  Limete: { lat: -4.36, lng: 15.34 },
  Matete: { lat: -4.39, lng: 15.34 },
  Lemba: { lat: -4.4, lng: 15.32 },
  Ngaliema: { lat: -4.34, lng: 15.25 },
  "Mont-Ngafula": { lat: -4.42, lng: 15.27 },
  Kisenso: { lat: -4.41, lng: 15.36 },
  Masina: { lat: -4.38, lng: 15.4 },
  Ndjili: { lat: -4.4, lng: 15.38 },
  Kimbanseke: { lat: -4.42, lng: 15.42 },
  Nsele: { lat: -4.38, lng: 15.5 },
  Maluku: { lat: -4.2, lng: 15.55 },
};

async function main() {
  const email = "demo@chipshop.cd";
  const password = await hashPassword("demo12345");

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Demo Kinshasa",
        email,
        phone: "+243810000001",
        emailVerified: true,
        wallet: {
          create: {
            balanceCents: 500_00,
            currency: "USD",
          },
        },
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: user.phone ?? "+243810000001" },
    });
    await prisma.wallet.upsert({
      where: { userId: user.id },
      create: { userId: user.id, balanceCents: 500_00 },
      update: { balanceCents: 500_00 },
    });
  }

  // Better Auth lie le mot de passe à accountId === user.id (pas l'email)
  const credential = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (!credential) {
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password,
      },
    });
  } else {
    await prisma.account.update({
      where: { id: credential.id },
      data: { accountId: user.id, password },
    });
  }

  // Toutes les communes de Kinshasa (catalogue HK+)
  for (const c of KINSHASA_COMMUNES) {
    const kind = CENTER.has(c.name) ? ("CENTER" as const) : ("REMOTE" as const);
    const coords = COORDS[c.name] ?? { lat: -4.33, lng: 15.31 };
    await prisma.deliveryZone.upsert({
      where: { commune: c.name },
      create: {
        commune: c.name,
        name: `${kind === "CENTER" ? "Centre" : "Périphérie"} ${c.name}`,
        kind,
        baseCents: kind === "CENTER" ? 250 : 500,
        ratePerKmCents: kind === "CENTER" ? 55 : 100,
        centerLat: coords.lat,
        centerLng: coords.lng,
      },
      update: {
        kind,
        baseCents: kind === "CENTER" ? 250 : 500,
        ratePerKmCents: kind === "CENTER" ? 55 : 100,
        centerLat: coords.lat,
        centerLng: coords.lng,
        isActive: true,
      },
    });
  }

  // Alias legacy "Mont Ngafula" → Mont-Ngafula already seeded
  const gombe = await prisma.deliveryZone.findUnique({
    where: { commune: "Gombe" },
  });
  const limete = await prisma.deliveryZone.findUnique({
    where: { commune: "Limete" },
  });
  const nsele = await prisma.deliveryZone.findUnique({
    where: { commune: "Nsele" },
  });

  const couriersSeed = [
    {
      name: "Jean Livreur",
      phone: "+243820000001",
      lat: -4.306,
      lng: 15.312,
      zoneId: gombe?.id,
    },
    {
      name: "Grace Moto",
      phone: "+243820000002",
      lat: -4.358,
      lng: 15.338,
      zoneId: limete?.id,
    },
    {
      name: "Patrick Express",
      phone: "+243820000003",
      lat: -4.375,
      lng: 15.49,
      zoneId: nsele?.id,
    },
  ];

  for (const c of couriersSeed) {
    const exists = await prisma.courier.findFirst({ where: { phone: c.phone } });
    if (!exists) {
      await prisma.courier.create({ data: { ...c, isAvailable: true } });
    } else {
      await prisma.courier.update({
        where: { id: exists.id },
        data: {
          lat: c.lat,
          lng: c.lng,
          zoneId: c.zoneId,
          isAvailable: true,
        },
      });
    }
  }

  // Organisation système unique
  let org = await prisma.organization.findUnique({
    where: { slug: "chipshop" },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Chip Shop",
        slug: "chipshop",
        metadata: JSON.stringify({ system: true }),
        members: {
          create: {
            userId: user.id,
            role: "owner",
          },
        },
      },
    });
  } else {
    const member = await prisma.member.findFirst({
      where: { organizationId: org.id, userId: user.id },
    });
    if (!member) {
      await prisma.member.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "owner",
        },
      });
    }
  }

  let shop = await prisma.shop.findFirst({
    where: { organizationId: org.id, slug: "store" },
  });
  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        organizationId: org.id,
        ownerUserId: user.id,
        name: "TechKinshasa Store",
        slug: "store",
        description: "Électronique vérifiée à Gombe",
        lat: -4.305,
        lng: 15.311,
      },
    });
  } else {
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        lat: -4.305,
        lng: 15.311,
        ownerUserId: shop.ownerUserId ?? user.id,
      },
    });
  }

  const catalog = [
    {
      title: "iPhone 15 Pro Max 256Go",
      priceCents: 1450_00,
      quantity: 3,
      category: "Tech",
      location: "Av. du Port, Q. Gombe, C. Gombe, Kinshasa",
      description: "Neuf sous blister. Garantie 1 an.",
      images: [
        "https://picsum.photos/seed/iphone15a/800/1000",
        "https://picsum.photos/seed/iphone15b/800/1000",
        "https://picsum.photos/seed/iphone15c/800/1000",
      ],
      colors: ["Noir", "Bleu", "Or"],
      sizes: ["Unique"],
    },
    {
      title: "AirPods Pro 2 USB-C",
      priceCents: 245_00,
      quantity: 10,
      category: "Tech",
      location: "Limete, Kinshasa",
      description: "Réduction de bruit active. Son spatial.",
      images: [
        "https://picsum.photos/seed/airpodsa/800/1000",
        "https://picsum.photos/seed/airpodsb/800/1000",
      ],
      colors: ["Blanc"],
      sizes: ["Unique"],
    },
    {
      title: "ASUS ROG Strix G15",
      priceCents: 1850_00,
      quantity: 2,
      category: "Gaming",
      location: "Bandalungwa, Kinshasa",
      description: "RTX 4060, 16Go RAM. Parfait gaming.",
      images: [
        "https://picsum.photos/seed/roga/800/1000",
        "https://picsum.photos/seed/rogb/800/1000",
      ],
      colors: ["Noir"],
      sizes: ["Unique"],
    },
    {
      title: "Nike Air Max 90",
      priceCents: 185_00,
      quantity: 8,
      category: "Mode",
      location: "Lingwala, Kinshasa",
      description: "Collection 2026. Tailles 40-45.",
      images: [
        "https://picsum.photos/seed/nikea/800/1000",
        "https://picsum.photos/seed/nikeb/800/1000",
        "https://picsum.photos/seed/nikec/800/1000",
      ],
      colors: ["Noir", "Blanc", "Rouge"],
      sizes: ["40", "41", "42", "43", "44", "45"],
    },
    {
      title: "Robe Africaine Wax",
      priceCents: 75_00,
      quantity: 15,
      category: "Mode",
      location: "Matete, Kinshasa",
      description: "Tissu wax authentique. Coupe moderne.",
      images: [
        "https://picsum.photos/seed/waxa/800/1000",
        "https://picsum.photos/seed/waxb/800/1000",
      ],
      colors: ["Rouge", "Vert", "Or"],
      sizes: ["S", "M", "L", "XL"],
    },
    {
      title: "PS5 + 2 Manettes",
      priceCents: 680_00,
      quantity: 4,
      category: "Gaming",
      location: "Bandalungwa, Kinshasa",
      description: "PS5 Disc Edition + 2 DualSense.",
      images: [
        "https://picsum.photos/seed/ps5a/800/1000",
        "https://picsum.photos/seed/ps5b/800/1000",
      ],
      colors: ["Blanc", "Noir"],
      sizes: ["Unique"],
    },
  ];

  for (const item of catalog) {
    const exists = await prisma.product.findFirst({
      where: { shopId: shop.id, title: item.title },
    });
    if (!exists) {
      await prisma.product.create({
        data: {
          shopId: shop.id,
          ...item,
          status: "ACTIVE",
        },
      });
    } else {
      await prisma.product.update({
        where: { id: exists.id },
        data: {
          images: item.images,
          colors: item.colors,
          sizes: item.sizes,
          quantity: item.quantity,
        },
      });
    }
  }

  // Messaging templates (owner) — lazy via ensureMessagingSetup at runtime;
  // seed skips encrypted keys (configurés dans /shops/messaging).

  console.log("Seed OK");
  console.log("  email: demo@chipshop.cd");
  console.log("  password: demo12345");
  console.log("  org: chipshop (système)");
  console.log(`  communes: ${KINSHASA_COMMUNES.length}`);
  console.log("  wallet: $500");
  console.log("  messaging: /shops/messaging (owner)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
