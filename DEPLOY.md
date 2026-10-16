# Déploiement prod — Ship Shop

Cible : VPS Klambocore, sous-domaine `https://shipshop.klambocore.com`.  
PostgreSQL **local** sur le port **5432** (pas Docker). Photos dans **`chipshop-uploads`**.

---

## 1. Prérequis VPS

| Élément | Détail |
|---|---|
| OS | Ubuntu 22.04 ou 24.04 |
| RAM | 2 Go minimum, **4 Go recommandé** (`next build` est lourd) |
| Swap | 2 Go si le VPS a 2 Go de RAM |
| Node | **20+** |
| Package manager | **pnpm** |
| PostgreSQL | **16** en local, `127.0.0.1:5432` seulement |
| Reverse proxy | **Nginx** + **Certbot** (HTTPS) |
| Processus | **systemd** (ou PM2) : `pnpm start` |
| Pare-feu | **80 / 443** ouverts ; **5432 fermé** sur Internet |
| Timezone | `Africa/Kinshasa` |

DNS :

```
A   shipshop.klambocore.com   → IP du VPS
```

Redirection optionnelle (lien court / autre host → l’app) :

```
return 3012 https://shipshop.klambocore.com$request_uri;
```

Une redirection ouvre l’app. Elle **ne connecte pas** un user déjà loggé sur Klambocore (auth séparée).

---

## 2. PostgreSQL (5432, pas Docker)

```sql
CREATE USER chipshop WITH PASSWORD '...fort...';
CREATE DATABASE chipshop OWNER chipshop;
```

`pg_hba.conf` / `postgresql.conf` : écoute **localhost** uniquement.

Chaîne :

```
DATABASE_URL="postgresql://chipshop:MOT_DE_PASSE@127.0.0.1:5432/shipshop?schema=public"
```

Migrations **prod** :

```bash
pnpm prisma migrate deploy
```

Ne pas lancer `prisma migrate dev`.  
Ne pas lancer `pnpm db:seed` en prod (compte démo).

---

## 3. Dossier photos (comme Eteyelo)

Toutes les images / vidéos vont dans **un dossier hors du repo**.

| Environnement | Chemin |
|---|---|
| Windows (dev) | `C:/chipshop-uploads` |
| Linux / VPS | `/var/www/chipshop-uploads` |

URL publique : `/uploads/...` (`NEXT_PUBLIC_UPLOAD_URL`).

```bash
sudo mkdir -p /var/www/chipshop-uploads
sudo chown -R <user-node>:<user-node> /var/www/chipshop-uploads
sudo chmod 755 /var/www/chipshop-uploads
```

Ce dossier n’est **pas** dans Git. Il doit survivre aux déploiements et être **sauvegardé**.

---

## 4. Variables `.env` prod

Copier `.env.example` puis renseigner :

```env
NODE_ENV=production

DATABASE_URL="postgresql://chipshop:MOT_DE_PASSE@127.0.0.1:5432/chipshop?schema=public"

BETTER_AUTH_SECRET="...32+ caractères aléatoires, jamais le secret de dev..."
BETTER_AUTH_URL="https://shipshop.klambocore.com"
NEXT_PUBLIC_APP_URL="https://shipshop.klambocore.com"

APP_NAME="ShipShop"
NEXT_PUBLIC_APP_NAME="Ship Shop"

ENCRYPTION_SECRET="...autre secret, à ne jamais changer après coup..."

UPLOAD_DIR=/var/www/chipshop-uploads
#UPLOAD_DIR=C:/chipshop-uploads
NEXT_PUBLIC_UPLOAD_URL=/uploads
```

Notes :

- `BETTER_AUTH_URL` et `NEXT_PUBLIC_APP_URL` en **https**, sans slash final.
- `NEXT_PUBLIC_*` est figé au **`pnpm build`**. Changement de nom / URL → **rebuild**.
- `ENCRYPTION_SECRET` chiffre les clés SMS / WhatsApp. Si tu le changes, les clés déjà enregistrées sont illisibles.
- Deux hôtes (ex. `shipshop.klambocore.com` + un autre domaine) : il faudra les deux dans Better Auth (`trustedOrigins`), sinon cookies / login cassés.

---

## 5. Nginx

`client_max_body_size 12m` (uploads jusqu’à 10 Mo).  
Headers `Host` + `X-Forwarded-Proto https` (cookies auth en HTTPS).

Exemple :

```nginx
client_max_body_size 12m;

server {
    listen 80;
    server_name shipshop.klambocore.com;
    return 3012 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name shipshop.klambocore.com;

    # ssl_certificate / ssl_certificate_key  (Certbot)

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

SSL :

```bash
sudo certbot --nginx -d shipshop.klambocore.com
```

---

## 6. systemd

L’app écoute en interne sur le **port 3000**. Nginx termine TLS.

```ini
[Unit]
Description=Ship Shop
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/shipshop
EnvironmentFile=/var/www/shipshop/.env
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ajuster `User`, `WorkingDirectory` et le chemin de `pnpm`.

```bash
sudo systemctl enable --now shipshop
sudo systemctl status shipshop
```

---

## 7. Ordre de mise en ligne

1. DNS + Postgres (user / base / 5432 localhost)
2. Code + `.env` prod
3. Dossier `/var/www/chipshop-uploads` + droits
4. `pnpm install --frozen-lockfile`
5. `pnpm prisma migrate deploy`
6. `pnpm build`
7. systemd + Nginx + SSL
8. Créer le **vrai owner** (pas `demo@chipshop.cd`)
9. Configurer SMS / WhatsApp dans `/shops/messaging` (clés Infobip / Klambo dans l’UI, pas dans `.env`)

---

## 8. Ce qu’on oublie souvent

| Sujet | Pourquoi |
|---|---|
| HTTPS + URL canonique | Auth Better Auth et liens d’invitation |
| `ENCRYPTION_SECRET` | Sinon fallback dangereux / clés illisibles plus tard |
| Uploads persistants | Hors Git, hors `.next` |
| Pas d’e-mail | Les invitations vont dans les **logs**, pas en SMTP |
| Compte owner | Créer le compte réel après migrate |
| Backups | `pg_dump` **et** `/var/www/chipshop-uploads` |
| RAM / swap | Sinon `next build` est tué |
| `NEXT_PUBLIC_*` au build | Rebuild obligatoire après changement |

---

## 9. Backups


Conserver plusieurs jours, hors du seul disque du VPS si possible.
