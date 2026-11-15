# Anubis — protection trafic web ShipShop (sans Docker)

Install native Ubuntu (`.deb` + systemd), comme Redis/Postgres locaux.  
**Ne protège pas les API mobile** : Nginx envoie `/api/` et `/uploads/` directement à Node.

| Fichier                      | Rôle                                      |
| ---------------------------- | ----------------------------------------- |
| `STAGING.md`                 | **Procédure d’activation VPS** (à suivre) |
| `install-native.sh`          | Install `.deb` + `anubis@shipshop`        |
| `shipshop.env`               | BIND `:8923` → TARGET `:3000`             |
| `shipshop.botPolicies.yaml`  | Politique staging (sans GeoIP)            |
| `nginx-shipshop-anubis.conf` | Snippet Nginx à fusionner                 |
| `nginx-staging.snippet.conf` | Variante courte                           |

Docs upstream : https://github.com/TecharoHQ/anubis — native install  
Release utilisée dans le script : **v1.28.2** (`ANUBIS_VERSION` pour surcharger).

## Retour arrière

`location /` → `proxy_pass http://127.0.0.1:3000;` puis `nginx -t && reload`.
