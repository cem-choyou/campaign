# Campaign — mise en production (VPS)

Cible : `https://campaign.choyou-tools.fr`, conteneur Docker sur le VPS de n8n, base Neon (branche `main`).

## 0. Prérequis (une seule fois)

1. **DNS** : enregistrement `A` `campaign.choyou-tools.fr` → IPv4 du VPS (et `AAAA` si IPv6), TTL 300.
   Vérifier : `dig +short campaign.choyou-tools.fr`.
2. **Reverse proxy** : inspecter le VPS avant toute modification.
   - `docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'`
   - `sudo ss -tlnp | grep -E ':80 |:443 '`
   - Si **rien** n'écoute sur 80/443 → utiliser le service `caddy` fourni (HTTPS automatique).
   - Si **Traefik** gère déjà n8n → supprimer `caddy` du compose, brancher `app` sur le réseau de
     Traefik et ajouter ces labels :
     - ``traefik.http.routers.campaign.rule=Host(`campaign.choyou-tools.fr`)``
     - `traefik.http.routers.campaign.tls.certresolver=<resolver existant>`
     - `traefik.http.services.campaign.loadbalancer.server.port=3000`
   - Si **Nginx** → server block `proxy_pass http://127.0.0.1:3000;` (publier le port 3000 en local
     seulement : `127.0.0.1:3000:3000`) + certificat `certbot --nginx -d campaign.choyou-tools.fr`.
   - Ne jamais modifier la configuration de n8n sans accord.
3. **Google OAuth** : redirection autorisée
   `https://campaign.choyou-tools.fr/api/auth/callback/google`.

## 1. Premier déploiement

```bash
# Depuis le poste de dev : envoyer le code (sans node_modules ni secrets)
git archive --format=tar.gz -o /tmp/campaign.tar.gz HEAD
scp /tmp/campaign.tar.gz vps:/opt/campaign/
ssh vps 'cd /opt/campaign && tar xzf campaign.tar.gz && rm campaign.tar.gz'

# Sur le VPS
cd /opt/campaign/deploy
cp .env.production.example .env && chmod 600 .env
# → remplir .env (AUTH_SECRET : openssl rand -base64 32)

docker compose --profile tools build
docker compose --profile tools run --rm tools npx prisma db push
docker compose --profile tools run --rm -e SEED_DEMO=false tools npx tsx prisma/seed.ts
docker compose up -d
```

## 2. Vérifications

```bash
docker compose ps                                   # app "healthy"
curl -sI https://campaign.choyou-tools.fr/connexion | grep -iE 'strict-transport|content-security|x-content-type'
curl -s https://campaign.choyou-tools.fr/api/health # {"status":"ok","db":"ok",…}
curl -sI http://campaign.choyou-tools.fr            # 308 vers https
```

Puis dans un navigateur : connexion Google avec un compte @choyou.fr, création d'une campagne,
reprise de l'assistant, ajout d'un post dans le calendrier.

## 3. Mise à jour

```bash
git archive --format=tar.gz -o /tmp/campaign.tar.gz HEAD && scp /tmp/campaign.tar.gz vps:/opt/campaign/
ssh vps
cd /opt/campaign && tar xzf campaign.tar.gz && rm campaign.tar.gz && cd deploy
docker tag campaign:latest campaign:previous        # point de retour
docker compose --profile tools build
docker compose --profile tools run --rm tools npx prisma db push   # si le schéma a changé
docker compose up -d app
```

`prisma db push` refuse toute perte de données sans confirmation explicite : lire le message avant
d'accepter. Pour une migration destructive, faire d'abord une branche Neon de sauvegarde.

## 4. Retour arrière

```bash
docker tag campaign:previous campaign:latest
docker compose up -d app
```

Base : Neon garde l'historique (restauration à un instant T depuis la console Neon).

## 5. Journaux

```bash
docker compose logs -f app     # JSON, sans données personnelles ni jetons
docker compose logs -f caddy
```
