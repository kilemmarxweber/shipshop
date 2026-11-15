# Activer Anubis staging sur le VPS (sans Docker)

Comme Redis / Postgres : binaire + systemd + Nginx.  
**Les appels mobile `/api/*` ne passent pas par Anubis.**

## Schéma

```text
Internet
   │
 Nginx :443
   ├─ /api/  /uploads/  /_next/static/  → 127.0.0.1:3000  (PM2 / Next)
   └─ /  (HTML)                         → 127.0.0.1:8923  (Anubis)
                                              └─ TARGET → 127.0.0.1:3000
```

## 0. Prérequis

- Ubuntu 22.04/24.04, accès `sudo`
- ShipShop déjà sur PM2 port **3000**
- Nginx + Certbot déjà OK
- Repo à jour sur le VPS (fichiers sous `infrastructure/anubis/`)
- `TRUST_PROXY=1` dans le `.env` de l’app

## 1. Installer Anubis (natif)

```bash
cd /var/www/shop/shipshop/infrastructure/anubis
# si le repo n’est pas encore à jour : git pull depuis la machine qui déploie
sudo bash install-native.sh
```

Manuel équivalent (amd64) :

```bash
VERSION=1.28.2
curl -fsSL -O "https://github.com/TecharoHQ/anubis/releases/download/v${VERSION}/anubis_${VERSION}_amd64.deb"
sudo apt install -y "./anubis_${VERSION}_amd64.deb"
sudo cp shipshop.env /etc/anubis/shipshop.env
sudo cp shipshop.botPolicies.yaml /etc/anubis/shipshop.botPolicies.yaml
sudo systemctl enable --now anubis@shipshop.service
```

Vérifier :

```bash
sudo systemctl status anubis@shipshop
curl -sI http://127.0.0.1:8923/ | head
journalctl -u anubis@shipshop -n 50 --no-pager
```

## 2. Brancher Nginx (activation staging)

```bash
# Backup
sudo cp /etc/nginx/sites-available/shipshop \
  /etc/nginx/sites-available/shipshop.bak.$(date +%F-%H%M)

# Éditer le server 443 : remplacer le seul location / proxy_pass :3000
# par le contenu de nginx-shipshop-anubis.conf
sudo nano /etc/nginx/sites-available/shipshop

sudo nginx -t && sudo systemctl reload nginx
```

Les `upstream` peuvent être en haut du fichier (hors `server`) ou dans un include.

## 3. Checklist de validation (15–30 min)

1. Ouvrir `https://shipshop.klambocore.com` en navigation privée → page charge (éventuel challenge léger).
2. Login Better Auth (cookies) → session OK.
3. Upload image produit.
4. App mobile : feed `/api/products` **sans** challenge (doit rester fluide).
5. Live / WebSocket si utilisé.
6. Security Center : `/shops/admin/security` (toujours via `/api` + page HTML).

Si challenge trop agressif : baisser `DIFFICULTY` dans `/etc/anubis/shipshop.env` puis :

```bash
sudo systemctl restart anubis@shipshop
```

## 4. Retour arrière immédiat

Dans Nginx, remettre :

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    # … headers habituels …
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
# optionnel
sudo systemctl stop anubis@shipshop
```

Ou restaurer le backup :

```bash
sudo cp /etc/nginx/sites-available/shipshop.bak.YYYY-MM-DD-HHMM \
  /etc/nginx/sites-available/shipshop
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Redis ?

Redis local **n’est pas requis** pour Anubis staging (`store: memory`).  
Le rate-limit API ShipShop reste sur **Postgres** (`ApiThrottle`).  
Redis pourra servir plus tard (sessions Anubis multi-instances) si tu scales.

## 6. Après validation staging

- Monter `DIFFICULTY` progressivement (2 → 4).
- Passer `ai-block-moderate` → `ai-block-aggressive` si faux positifs bas.
- Surveiller mails `SECURITY_ALERT_EMAIL` + Security Center.
