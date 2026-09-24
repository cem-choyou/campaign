# Campaign — mise en production (VPS)

Cible : `https://campaign.choyou-tools.fr`, conteneur Docker sur le VPS de n8n (`root@178.104.151.168`,
Ubuntu 24.04), base Neon projet `campaign` (Francfort, branche `main`).
Mise en production initiale : 24/09/2026.

## Architecture sur le VPS

- Code : `/opt/campaign` (à côté de `/opt/n8n` et `/opt/albert`, jamais modifiés).
- App : conteneur `campaign-app-1`, écoute seulement `127.0.0.1:3000` (`deploy/docker-compose.yml`).
- Reverse proxy : **nginx du VPS** (comme n8n), site `/etc/nginx/sites-available/campaign`, copie de
  `deploy/nginx/campaign.conf` + lignes TLS ajoutées par certbot.
- HTTPS : Let's Encrypt via `certbot --nginx`, renouvelé par `certbot.timer`.
- Secrets : `/opt/campaign/deploy/.env` (`chmod 600`, rempli sur le serveur, jamais dans le dépôt).
  Modèle : `deploy/.env.production.example`.
- DNS : OVH, zone `choyou-tools.fr`, enregistrement `A campaign → 178.104.151.168`.

## 1. Premier déploiement (déjà fait, pour mémoire)

```bash
# Poste de dev : envoyer le code (sans node_modules ni secrets)
git archive --format=tar.gz -o /tmp/campaign.tar.gz HEAD
scp /tmp/campaign.tar.gz root@178.104.151.168:/opt/campaign/
ssh root@178.104.151.168 'cd /opt/campaign && tar xzf campaign.tar.gz && rm campaign.tar.gz'

# VPS
cd /opt/campaign/deploy          # .env rempli (AUTH_SECRET : openssl rand -base64 32)
docker compose --profile tools build
docker compose --profile tools run --rm -T tools npx prisma db push
docker compose --profile tools run --rm -T -e SEED_DEMO=false tools npx tsx prisma/seed.ts
docker compose up -d app
cp nginx/campaign.conf /etc/nginx/sites-available/campaign
ln -s /etc/nginx/sites-available/campaign /etc/nginx/sites-enabled/campaign
nginx -t && systemctl reload nginx
certbot --nginx -d campaign.choyou-tools.fr --non-interactive --redirect
```

Google OAuth : origine `https://campaign.choyou-tools.fr`, redirection
`https://campaign.choyou-tools.fr/api/auth/callback/google`, écran de consentement « Interne ».

## 2. Vérifications

```bash
docker compose ps                                     # app "healthy"
curl -s https://campaign.choyou-tools.fr/api/health   # {"status":"ok","db":"ok",…}
curl -sI https://campaign.choyou-tools.fr/connexion | grep -iE 'strict-transport|content-security|x-content-type'
curl -sI http://campaign.choyou-tools.fr              # 301 vers https
```

## 3. Mise à jour

```bash
git archive --format=tar.gz -o /tmp/campaign.tar.gz HEAD
scp /tmp/campaign.tar.gz root@178.104.151.168:/opt/campaign/
ssh root@178.104.151.168
cd /opt/campaign && tar xzf campaign.tar.gz && rm campaign.tar.gz && cd deploy
docker tag campaign:latest campaign:previous          # point de retour
docker compose --profile tools build
docker compose --profile tools run --rm -T tools npx prisma db push   # si le schéma a changé
docker compose up -d app
```

`prisma db push` refuse toute perte de données sans confirmation explicite : lire le message avant
d'accepter. Pour une migration destructive, faire d'abord une branche Neon de sauvegarde.
Après une modification de `.env` : `docker compose up -d app` (recrée le conteneur).
Après une modification de `nginx/campaign.conf` : reporter le changement dans
`/etc/nginx/sites-available/campaign` **sans effacer les lignes certbot**, puis `nginx -t && systemctl reload nginx`.

## 4. Retour arrière

```bash
docker tag campaign:previous campaign:latest
docker compose up -d app
```

Base : Neon garde l'historique (restauration à un instant T depuis la console Neon).

## 5. Journaux

```bash
docker compose logs -f app       # JSON, sans données personnelles ni jetons
tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```
