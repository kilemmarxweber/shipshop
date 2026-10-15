# Chip Shop

Marketplace RDC — tiers de confiance avec portefeuille Mobile Money prépayé.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui
- PostgreSQL + Prisma 7
- Better Auth (email/password + organization / invitation / member)

## Démarrage

1. Démarrer Postgres local Prisma Dev (si besoin) :

```bash
npx prisma dev --name chipshop
```

2. Mettre à jour `DATABASE_URL` dans `.env` avec l’URL affichée.

3. Migrer + seed :

```bash
npm run db:migrate
npm run db:seed
```

4. Lancer l’app :

```bash
npm run dev
```

Compte démo : `demo@chipshop.cd` / `demo12345` (solde $500).

## Fonctionnalités V1

- Compte obligatoire pour acheter
- Wallet + recharge M-Pesa / Orange / Airtel **simulée**
- Achat uniquement si solde suffisant
- Org Better Auth → 1..N shops → produits
- Publication en 3 étapes
- Shell tablette responsive (design Chip Shop)

## Docker (optionnel)

```bash
docker compose up -d
```

Puis `DATABASE_URL=postgresql://chipshop:chipshop@localhost:5432/chipshop`
