# CLAUDE.md — Campaign (ChoYou / IT for Business)

> **Nom du produit : Campaign.** URL : `https://campaign.choyou-tools.fr`. Le nom « Campaign » apparaît dans l'UI (titre, logo texte, onglet du navigateur, e-mails, pages kit) ; le reste de l'interface reste en français. Nom du dépôt / package : `campaign`.

> Fichier de contexte pour Claude Code. À lire en entier avant toute tâche.
> Il fait foi sur les décisions produit, techniques et UX. Si une demande le contredit, le signaler avant d'agir.
> Tenir ce fichier à jour à la fin de chaque lot (section « État d'avancement »).

---

## 0. Comment travailler sur ce projet

- **Langue** : interface 100 % en français. Code, noms de variables, commits et commentaires techniques en anglais. Échanges avec Cem en français.
- **Un lot à la fois** (voir §14). Pour chaque lot : passer en mode plan, proposer un plan détaillé (fichiers, schéma, écrans, risques), attendre la validation de Cem, puis exécuter.
- **Petits commits** atomiques et descriptifs (Conventional Commits : `feat:`, `fix:`, `chore:`…). Jamais de secret committé.
- **Aucune dépendance hors de la liste §3** sans demander. Préférer ce qui est déjà dans le projet.
- **Qualité UX = critère d'acceptation**, pas une finition. Un écran n'est « fini » que s'il respecte la checklist §8.12.
- **Vérifier visuellement** : après chaque écran, lancer l'app et contrôler avec Playwright (captures en desktop 1440 px et mobile 390 px, thème clair et sombre). Corriger avant de dire « terminé ».
- **Tester** ce qui est logique métier (import Excel, calcul des dates, machine à états, droits, tokens de kit) avec Vitest. Parcours critiques en e2e Playwright (§13).
- **En cas de doute sur un choix produit** : poser la question plutôt que deviner. Les points encore ouverts sont listés en §16.

---

## 1. Le produit en une minute

Une app web où l'équipe ChoYou planifie une **campagne de communication multi-canal** (LinkedIn, YouTube, Shorts) sur un calendrier.
L'IA rédige chaque post selon le **prompt de la marque**. Un humain **valide**. Ensuite :

- les posts de la **page LinkedIn** partent automatiquement via **n8n** (lot 4 ; avant ça, ils partent en « kit » à la personne qui gère la page) ;
- les vidéos et **Shorts YouTube** sont programmés à la main dans **YouTube Studio** ; l'app fournit titres/descriptions et suit leur mise en ligne ;
- les **collaborateurs relais** (ex. Anne Laure) reçoivent un e-mail à J-1 et le jour J avec un lien vers leur **kit du jour** (texte prêt, vidéo, démarche) pour poster ou relayer depuis leur profil.

Une campagne peut être **importée depuis un fichier Excel** (modèle fourni par l'app) : l'app crée tous les posts en brouillon et l'IA rédige les textes manquants.

**Marque de départ** : IT for Business. **Multi-marques dès le socle** pour accueillir des clients sans refonte.

**Critère de réussite de la V1** : la campagne « Vidéo LDDLT » est gérée entièrement dans l'outil, et l'équipe y passe moins de temps qu'avec l'Excel. Toute fonctionnalité qui ne sert pas ce but attend.

**Hors périmètre** : Meta Ads / Google Ads (future plateforme séparée), analytics détaillées, réponses aux commentaires, publication automatique sur des profils personnels (plus tard), upload automatique vers YouTube (plus tard).

---

## 2. Vocabulaire (utiliser ces mots partout : UI, code, docs)

| Terme UI | Terme code | Définition |
| --- | --- | --- |
| Marque | `Brand` | Un client ou une marque interne. Porte le prompt IA, les comptes, les relais. |
| Compte | `SocialAccount` | Page LinkedIn ou chaîne YouTube d'une marque. |
| Campagne | `Campaign` | Ensemble de posts datés autour d'un objectif (ex. « Promotion vidéo LDDLT »). |
| Contenu | `Content` | Un média décrit une seule fois : vidéo longue, capsule, Short, image, PDF. Identifié par un code (`CAP1`, `SHORT3`, `VID-LONG`). |
| Post | `Post` | Une publication datée sur **un** canal (1 ligne du planning Excel = 1 post). |
| Relais | `Contributor` | Collaborateur (sans compte sur l'app) qui poste ou relaie depuis son profil. |
| Mission | `Mission` | Ce qu'un relais doit faire pour un post : **Poster** ou **Relayer**. |
| Kit du jour | page `/kit/[token]` | Page publique personnelle d'une mission : texte, média, démarche, bouton « C'est publié ». |
| Mode de publication | `PublishMode` | `AUTO` (n8n publie), `STUDIO` (YouTube Studio à la main), `KIT` (une personne publie avec son kit). |

---

## 3. Stack technique

Même base qu'Essential 2.0 (voir §15 pour les leçons apprises), avec ces choix :

- **Next.js** dernière version stable, **App Router**, React Server Components, Server Actions. Sortie `output: "standalone"` pour Docker.
- **TypeScript** en mode `strict`. Pas de `any` sans commentaire justificatif.
- **Tailwind CSS** + **shadcn/ui** (composants copiés dans `src/components/ui`). Icônes **lucide-react**. Police **Inter** via `next/font` (pas de requête Google au runtime).
- **Framer Motion** pour les transitions (sobres, voir §8.10).
- **Prisma** (version stable courante, 7+ : configuration dans `prisma.config.ts` + driver adapter, voir §15) + **PostgreSQL Neon** (région UE, Francfort `eu-central-1`, la plus proche du VPS).
- **Auth.js (NextAuth v5)** avec **Prisma Adapter** et **sessions en base** (pas JWT), voir §9.
- **Zod** pour toute validation (formulaires, Server Actions, payloads n8n, import Excel). **react-hook-form** + `@hookform/resolvers/zod`.
- **FullCalendar v6** (`daygrid`, `timegrid`, `list`, `interaction`) pour le calendrier, locale `fr`.
- **@dnd-kit** si besoin de glisser-déposer hors calendrier (réordonner).
- **exceljs** pour lire les imports **et** générer le modèle Excel (validations de données, couleurs, formules). Ne pas utiliser le paquet npm `xlsx` (SheetJS), obsolète sur npm.
- **SDK officiel Anthropic** (`@anthropic-ai/sdk`) pour la génération en streaming et les sorties structurées (`messages.parse` + `zodOutputFormat`). Modèle **Claude Sonnet 5** configurable par variable d'env (`AI_MODEL`, défaut `claude-sonnet-5`). Tout appel au fournisseur passe par `src/server/ai/client.ts` : changer de fournisseur ne touche que ce fichier. *(Décidé le 24/09/2026 à la place du Vercel AI SDK + OpenAI prévu au départ.)*
- **date-fns** + **date-fns-tz** : stockage en UTC, affichage en `Europe/Paris` (§6.4).
- **sonner** pour les toasts. **cmdk** pour la palette de commandes (⌘K).
- **React Email** (`@react-email/components`) pour les templates d'e-mails (relais et magic link).
- **Resend** pour les e-mails envoyés par l'app elle-même (magic links). Les e-mails aux relais sont envoyés **par n8n** (§11), mais leur HTML est **rendu par l'app**.
- **Cloudflare R2** (API S3, `@aws-sdk/client-s3` + URL présignées) pour les médias : **lot 4 seulement**. En V1, les médias restent des liens (Frame.io, Drive).
- Tests : **Vitest** + **Testing Library**, **Playwright** (e2e + captures).
- Qualité : ESLint (config Next), Prettier, `tsc --noEmit` en CI locale (`npm run check`).

---

## 4. Architecture

```
Équipe / clients ──> App Next.js (VPS, Docker) ──> Neon Postgres
                          │   ├─> OpenAI (génération, streaming)
                          │   ├─> Resend (magic links)
                          │   └─> R2 (médias, lot 4)
                          │
      n8n (même VPS) ─────┤  GET  /api/n8n/*  (travail dû, e-mails rendus)
                          │  POST /api/n8n/*  (résultats, statuts, décisions)
                          ├─> LinkedIn API (lot 4)
                          ├─> YouTube Data API (lecture du statut)
                          ├─> Gmail (e-mails aux relais)
                          └─> Telegram (validation, alertes)
```

Principes :
- **L'app est la source de vérité** (campagnes, contenus, statuts). n8n est un **exécutant** : il demande le travail dû, l'exécute, renvoie le résultat.
- **La génération IA se fait dans l'app** (streaming visible dans l'éditeur), pas dans n8n.
- **Les tokens OAuth des réseaux** (lot 4) sont gérés et **chiffrés par l'app** (AES-256-GCM, clé `ENCRYPTION_KEY`), et transmis à n8n dans le payload. Pas un credential n8n par client.
- **Communication app ↔ n8n** : header `X-N8N-Token` (secret partagé, comparaison à temps constant), HTTPS uniquement, rate limit.

---

## 5. Déploiement, domaine, HTTPS, cookies

Objectif : **zéro friction** — jamais d'avertissement de certificat, jamais de reconnexion inutile, jamais de bandeau cookies inutile.

- **Hébergement** : VPS existant, à côté de n8n. App en conteneur Docker (image multi-stage, `node:lts-alpine`, utilisateur non root, `HEALTHCHECK` sur `/api/health`).
- **Domaine** : `campaign.choyou-tools.fr` (décidé par Cem, cohérent avec `essential.choyou-tools.fr`). Enregistrement DNS A/AAAA vers le VPS à créer avant le premier déploiement.
- **Reverse proxy + certificats** : si n8n est déjà derrière un reverse proxy (Traefik, Nginx, Caddy), **réutiliser le même** (à vérifier avec Cem, §16). Sinon, **Caddy** : certificats Let's Encrypt automatiques et renouvelés seuls, redirection HTTP → HTTPS, HTTP/2 et 3.
- **En-têtes** : HSTS (`max-age=31536000; includeSubDomains`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal, CSP stricte (nonces Next.js), `frame-ancestors 'none'`.
- **Auth derrière proxy** : `AUTH_URL=https://campaign.choyou-tools.fr`, `AUTH_TRUST_HOST=true`.
- **Cookies** :
  - uniquement des cookies **strictement nécessaires** : session Auth.js (`__Secure-authjs.session-token`), CSRF, préférences d'interface (thème, vue calendrier, marque active) ;
  - `HttpOnly`, `Secure`, `SameSite=Lax`, préfixe `__Secure-` ;
  - **pas d'analytics tiers ni de pixel** → **pas de bandeau de consentement** requis (cookies exemptés au sens de la CNIL). Une ligne dans la page « Confidentialité » les décrit. Si un jour on ajoute de la mesure d'audience, utiliser une solution sans cookie (Plausible ou Umami auto-hébergé) ;
  - les **pages kit** (`/kit/*`) ne posent **aucun cookie**.
- **Sessions** : durée 30 jours, glissante (`updateAge` 24 h). L'utilisateur reste connecté d'une visite à l'autre. Après connexion, retour exact à la page demandée (`callbackUrl`).
- **Pages légales** : `/confidentialite` (données des relais : nom, e-mail, usage, durée de conservation, contact) et `/mentions-legales`. Lien discret en pied de page, aussi sur les kits et dans les e-mails.
- **Environnements** : `dev` local, `production` sur le VPS. Base Neon : une branche `dev`, une branche `main`.

---

## 6. Modèle de données

### 6.1 Décisions de modélisation

- **1 post = 1 canal.** Une ligne du planning = un post. (La table `Publication` évoquée dans le doc d'architecture est fusionnée dans `Post`.)
- Un post est publié **soit** par un compte de la marque (`socialAccountId`) **soit** par un relais depuis son profil (`authorContributorId`, via une mission `POST`). Exactement l'un des deux (contrôle Zod + contrainte applicative).
- Les **relais n'ont pas de compte utilisateur**. Leur accès passe par des liens signés (§9.4).
- Le **prompt de marque est structuré** en champs guidés, assemblés au moment de la génération (§10).
- Suppression **douce** (`archivedAt`) pour marques et campagnes, avec annulation possible.
- Toutes les dates en **UTC** en base.

### 6.2 Schéma Prisma (point de départ, à affiner au lot 1)

```prisma
generator client {
  provider = "prisma-client-js"
}

// Prisma 7+ : les URLs ne sont plus dans le schéma (voir §15, « Prisma 7 »).
datasource db {
  provider = "postgresql"
}

// ---------- Auth.js ----------
model User {
  id            String       @id @default(cuid())
  email         String       @unique
  name          String?
  image         String?
  emailVerified DateTime?
  isSuperAdmin  Boolean      @default(false) // équipe ChoYou : accès à toutes les marques
  isActive      Boolean      @default(true)
  lastBrandId   String?      // dernière marque ouverte, pour reprendre où on en était
  accounts      Account[]
  sessions      Session[]
  memberships   Membership[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

// ---------- Marques & accès ----------
model Brand {
  id                String          @id @default(cuid())
  name              String
  slug              String          @unique
  color             String          @default("#1F3A5F") // accent de la marque dans l'UI et les kits
  logoUrl           String?
  timezone          String          @default("Europe/Paris")
  // Prompt structuré (voir §10)
  editorialLine     String          @default("") @db.Text
  tone              String          @default("") @db.Text
  dos               String          @default("") @db.Text
  donts             String          @default("") @db.Text
  examplePosts      Json            @default("[]") // [{ body, note? }]
  hashtags          String[]
  defaultCta        String?
  mentionHandle     String?         // ex. "IT for Business" à taguer
  extraInstructions String?         @db.Text
  // Réglages relais
  missionD1Hour     Int             @default(18) // heure locale de l'e-mail J-1
  archivedAt        DateTime?
  memberships       Membership[]
  accounts          SocialAccount[]
  campaigns         Campaign[]
  contributors      Contributor[]
  activities        Activity[]
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
}

enum BrandRole {
  ADMIN      // tout, y compris comptes, relais, accès
  VALIDATOR  // rédiger + valider
  EDITOR     // rédiger, soumettre en revue
  CLIENT     // voir sa marque, commenter ; valider si clientCanApprove
}

model Membership {
  id               String    @id @default(cuid())
  userId           String
  brandId          String
  role             BrandRole
  clientCanApprove Boolean   @default(false)
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  brand            Brand     @relation(fields: [brandId], references: [id], onDelete: Cascade)
  createdAt        DateTime  @default(now())
  @@unique([userId, brandId])
}

enum Platform {
  LINKEDIN
  YOUTUBE
}

enum PublishMode {
  AUTO    // n8n publie (page LinkedIn, lot 4)
  STUDIO  // programmé à la main dans YouTube Studio
  KIT     // une personne publie avec son kit (page LinkedIn avant le lot 4)
}

model SocialAccount {
  id               String       @id @default(cuid())
  brandId          String
  platform         Platform
  name             String       // "IT for Business" (page), "IT for Business YouTube"
  url              String?
  externalId       String?      // urn:li:organization:… ou channelId
  publishMode      PublishMode
  kitContributorId String?      // si KIT : qui reçoit le kit pour publier
  accessTokenEnc   String?      @db.Text // lot 4, chiffré AES-256-GCM
  refreshTokenEnc  String?      @db.Text
  tokenExpiresAt   DateTime?
  connectedById    String?
  connectedAt      DateTime?
  isActive         Boolean      @default(true)
  brand            Brand        @relation(fields: [brandId], references: [id], onDelete: Cascade)
  kitContributor   Contributor? @relation("KitContributor", fields: [kitContributorId], references: [id], onDelete: SetNull)
  posts            Post[]
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
}

// ---------- Campagnes ----------
enum CampaignStatus {
  DRAFT      // en préparation, rien ne part
  ACTIVE     // lancée : les posts validés partent / les kits sont envoyés
  COMPLETED  // tous les posts sont passés
  ARCHIVED
}

model Campaign {
  id            String         @id @default(cuid())
  brandId       String
  name          String
  status        CampaignStatus @default(DRAFT)
  objective     String?        @db.Text
  audience      String?        @db.Text
  brief         String?        @db.Text
  startDate     DateTime?      @db.Date // lundi de la semaine 1
  endDate       DateTime?      @db.Date
  mainContentId String?        // vidéo principale (ex. VID-LONG)
  wizardStep    Int            @default(1) // reprise de l'assistant là où on s'est arrêté
  launchedAt    DateTime?
  createdById   String
  archivedAt    DateTime?
  brand         Brand          @relation(fields: [brandId], references: [id], onDelete: Cascade)
  contents      Content[]
  posts         Post[]
  imports       ImportJob[]
  activities    Activity[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  @@index([brandId, status])
}

enum ContentType {
  LONG_VIDEO
  CAPSULE
  SHORT
  IMAGE
  DOCUMENT
}

model Content {
  id             String      @id @default(cuid())
  campaignId     String
  code           String      // CAP1, SHORT1, VID-LONG (unique dans la campagne)
  type           ContentType
  title          String
  mediaUrl       String?     // lien Frame.io / Drive / R2
  storageKey     String?     // R2 (lot 4)
  durationSec    Int?
  summary        String?     @db.Text // message clé, sert de contexte à l'IA
  youtubeVideoId String?     // renseigné quand la vidéo est programmée dans Studio
  parentId       String?     // un Short pointe vers sa vidéo longue
  parent         Content?    @relation("ContentParent", fields: [parentId], references: [id], onDelete: SetNull)
  children       Content[]   @relation("ContentParent")
  campaign       Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  posts          Post[]      @relation("PostContent")
  linkedFrom     Post[]      @relation("PostLinkTo")
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  @@unique([campaignId, code])
}

enum PostFormat {
  VIDEO_POST
  SHORT
  LONG_VIDEO
  IMAGE
  DOCUMENT
  TEXT
}

enum PostStatus {
  DRAFT       // brouillon
  IN_REVIEW   // soumis, en attente de validation
  APPROVED    // validé, attend son heure (ou sa confirmation Studio/kit)
  PROCESSING  // n8n l'a pris (verrou), mode AUTO
  PUBLISHED
  FAILED      // 3 essais KO (AUTO) ou kit non confirmé après relance
  CANCELLED
}

enum BodySource {
  EMPTY
  AI
  HUMAN     // écrit ou retouché à la main
  IMPORTED  // venu de l'Excel
}

model Post {
  id                  String         @id @default(cuid())
  campaignId          String
  contentId           String?
  socialAccountId     String?        // publié par un compte de la marque…
  authorContributorId String?        // …ou par un relais depuis son profil
  format              PostFormat
  scheduledAt         DateTime       // UTC
  angle               String?        @db.Text // « sujet / angle » saisi ou importé
  body                String?        @db.Text
  bodySource          BodySource     @default(EMPTY)
  youtubeTitle        String?
  youtubeDescription  String?        @db.Text
  youtubeTags         String[]
  linkToContentId     String?        // ex. un Short renvoie vers VID-LONG
  linkToUrl           String?
  relatedVideoAdded   Boolean        @default(false) // case « vidéo associée ajoutée dans Studio »
  status              PostStatus     @default(DRAFT)
  submittedAt         DateTime?
  approvedById        String?
  approvedAt          DateTime?
  rejectionReason     String?        @db.Text
  aiPromptUsed        Json?          // prompt réellement envoyé (réglage de la marque)
  lockedAt            DateTime?      // verrou n8n
  attempts            Int            @default(0)
  lastError           String?        @db.Text
  externalId          String?        // urn du post LinkedIn / id vidéo
  publishedUrl        String?
  publishedAt         DateTime?
  importRowRef        String?        // "Planning!12" pour tracer l'origine
  campaign            Campaign       @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  content             Content?       @relation("PostContent", fields: [contentId], references: [id], onDelete: SetNull)
  linkToContent       Content?       @relation("PostLinkTo", fields: [linkToContentId], references: [id], onDelete: SetNull)
  socialAccount       SocialAccount? @relation(fields: [socialAccountId], references: [id], onDelete: SetNull)
  authorContributor   Contributor?   @relation("AuthoredPosts", fields: [authorContributorId], references: [id], onDelete: SetNull)
  missions            Mission[]
  comments            Comment[]
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
  @@index([status, scheduledAt])
  @@index([campaignId, scheduledAt])
}

// ---------- Relais ----------
model Contributor {
  id          String          @id @default(cuid())
  brandId     String
  firstName   String
  lastName    String?
  email       String
  jobTitle    String?
  linkedinUrl String?
  toneNote    String?         @db.Text // « direct, un peu d'humour, pas d'emoji »
  samplePosts Json            @default("[]")
  isActive    Boolean         @default(true)
  brand       Brand           @relation(fields: [brandId], references: [id], onDelete: Cascade)
  missions    Mission[]
  authored    Post[]          @relation("AuthoredPosts")
  kitFor      SocialAccount[] @relation("KitContributor")
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  @@unique([brandId, email])
}

enum MissionType {
  POST   // publier sur son profil (ou sur la page en mode KIT)
  RELAY  // commenter / republier le post de la page
}

enum MissionStatus {
  PLANNED    // rien d'envoyé
  NOTIFIED   // au moins un e-mail envoyé
  OPENED     // kit ouvert
  DONE       // « C'est publié » confirmé
  MISSED     // pas de confirmation après relance
  CANCELLED
}

model Mission {
  id                String        @id @default(cuid())
  postId            String
  contributorId     String
  type              MissionType
  body              String?       @db.Text // texte personnalisé pour ce relais
  suggestedComments Json          @default("[]") // RELAY : 2-3 commentaires proposés
  status            MissionStatus @default(PLANNED)
  sendingLockAt     DateTime?     // verrou pendant qu'n8n envoie
  d1SentAt          DateTime?
  d0SentAt          DateTime?
  openedAt          DateTime?
  doneAt            DateTime?
  publishedUrl      String?
  reminderSentAt    DateTime?
  escalatedAt       DateTime?
  post              Post          @relation(fields: [postId], references: [id], onDelete: Cascade)
  contributor       Contributor   @relation(fields: [contributorId], references: [id], onDelete: Cascade)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  @@unique([postId, contributorId])
}

// ---------- Divers ----------
model Comment {
  id         String    @id @default(cuid())
  postId     String
  authorId   String
  body       String    @db.Text
  resolvedAt DateTime?
  post       Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  createdAt  DateTime  @default(now())
}

enum ImportStatus {
  PARSED         // lu, aperçu disponible
  NEEDS_MAPPING  // Excel libre : correspondance des colonnes à confirmer
  IMPORTED
  FAILED
}

model ImportJob {
  id          String       @id @default(cuid())
  brandId     String
  campaignId  String?
  fileName    String
  status      ImportStatus
  mapping     Json?
  report      Json         // { rows, created, warnings[], errors[] }
  createdById String
  campaign    Campaign?    @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  createdAt   DateTime     @default(now())
}

model Activity {
  id         String    @id @default(cuid())
  brandId    String
  campaignId String?
  postId     String?
  actorId    String?   // utilisateur
  actorLabel String?   // "n8n", "Anne Laure (relais)"
  type       String    // post.approved, post.published, mission.done, campaign.renamed…
  meta       Json      @default("{}")
  brand      Brand     @relation(fields: [brandId], references: [id], onDelete: Cascade)
  campaign   Campaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
  createdAt  DateTime  @default(now())
  @@index([campaignId, createdAt])
}
```

### 6.3 Machine à états d'un post

```
DRAFT ──soumettre──> IN_REVIEW ──valider──> APPROVED ──(AUTO) n8n prend──> PROCESSING ──ok──> PUBLISHED
  ^                     │                      │                              └─3 échecs─> FAILED ──relancer──> APPROVED
  └────refuser (motif)──┘                      ├─(STUDIO) vidéo en ligne détectée──> PUBLISHED
                                               └─(KIT) mission confirmée « C'est publié »──> PUBLISHED
Tout état sauf PUBLISHED ──annuler──> CANCELLED
```

Règles :
- **Modifier le texte ou le média** d'un post `APPROVED` le repasse en `DRAFT`, **après une confirmation** claire (« Ce post est validé. Le modifier demandera une nouvelle validation. »).
- **Déplacer la date** d'un post `APPROVED` ne retire pas la validation (le contenu n'a pas changé). Refuser une date passée, avertir si moins d'1 h avant.
- `PROCESSING` et `PUBLISHED` sont **verrouillés** en édition.
- Un post n'est pris par n8n que si **sa campagne est `ACTIVE`**. Une campagne `DRAFT` ne publie jamais rien, même avec des posts validés.
- Les transitions passent **toutes** par une seule fonction (`src/server/posts/transitions.ts`) qui vérifie les droits, écrit l'`Activity` et déclenche les effets (webhook de validation Telegram…). Testée unitairement.
- Le verrou `lockedAt` expire après 10 min (reprise si n8n plante).

### 6.4 Dates et fuseaux

- Base en UTC. Affichage, saisie et calculs de jours en **heure de la marque** (`Brand.timezone`, défaut `Europe/Paris`).
- Calcul depuis l'Excel : `date = startDate (lundi S1) + (semaine − 1) × 7 + décalage du jour`, puis heure locale → UTC avec `date-fns-tz` (attention aux changements d'heure d'octobre et mars : tests dédiés).
- Formats d'affichage : « lun. 5 oct. », « 09:00 », relatif quand utile (« dans 2 h », « hier »).

---

## 7. Droits d'accès

| Action | Super admin | Admin marque | Valideur | Éditeur | Client |
| --- | --- | --- | --- | --- | --- |
| Voir toutes les marques | ✓ | — | — | — | — |
| Voir la marque, ses campagnes | ✓ | ✓ | ✓ | ✓ | ✓ (la sienne seulement) |
| Créer / éditer campagnes et posts | ✓ | ✓ | ✓ | ✓ | — |
| Soumettre en revue | ✓ | ✓ | ✓ | ✓ | — |
| Valider / refuser | ✓ | ✓ | ✓ | — | si `clientCanApprove` |
| Commenter un post | ✓ | ✓ | ✓ | ✓ | ✓ |
| Lancer / mettre en pause une campagne | ✓ | ✓ | ✓ | — | — |
| Gérer relais, comptes, prompt de marque | ✓ | ✓ | — | — | — |
| Gérer les accès (inviter, rôles) | ✓ | ✓ | — | — | — |
| Créer une marque | ✓ | — | — | — | — |

- Vérifié **côté serveur** dans chaque Server Action et route (`requireBrandRole(brandId, minRole)`), jamais seulement en masquant un bouton.
- Plusieurs valideurs par marque : **le premier qui valide** débloque le post ; son nom est enregistré (`approvedById`).
- Un client ne voit jamais une autre marque, ni les réglages, ni les données des relais au-delà du prénom.
- La session relit rôle et appartenances **depuis la base à chaque requête** (leçon Essential) : un changement de rôle s'applique sans reconnexion.

---

## 8. UX — exigences détaillées

### 8.1 Principes

1. **Accompagner en douceur.** L'utilisateur n'a jamais à savoir « comment ça marche » : chaque écran dit ce qu'il y a à faire ensuite, avec une action principale évidente.
2. **Ne jamais perdre de travail.** Enregistrement automatique partout, indicateur discret « Enregistré », garde anti-fermeture si une sauvegarde est en cours.
3. **Tout est réversible.** Suppressions et archivages avec « Annuler » dans le toast (8 s). Confirmation modale seulement pour ce qui est irréversible (supprimer définitivement, lancer une campagne).
4. **Moins de clics.** Édition en place (renommer d'un clic), glisser-déposer dans le calendrier, actions en masse, raccourcis clavier.
5. **Montrer avant de faire.** Aperçu réaliste du post LinkedIn/YouTube, aperçu de l'import avant création, aperçu de l'e-mail et du kit avant envoi, « Envoyer un test à moi ».
6. **Calme et lisible.** Interface sobre (esprit Linear / Notion), une couleur d'accent (celle de la marque), hiérarchie claire, pas de surcharge.

### 8.2 Navigation et structure

- **Barre latérale** (repliable, état mémorisé) :
  - en haut : **sélecteur de marque** (logo + nom, recherche si > 5 marques) ;
  - Aujourd'hui · Campagnes · Calendrier · À valider (badge du nombre) · Relais · Réglages de la marque ;
  - en bas : aide, thème clair/sombre, profil.
- **Palette de commandes ⌘K / Ctrl K** : aller à une campagne, créer une campagne, importer un Excel, télécharger le modèle, changer de marque, rechercher un post.
- **Fil d'Ariane** sur les pages profondes. URLs lisibles et partageables : `/[brandSlug]/campagnes/[id]`, `?post=[id]` ouvre le panneau d'un post (lien partageable pour faire valider).
- Retour à la **dernière marque ouverte** à la connexion (`lastBrandId`).

### 8.3 Page « Aujourd'hui » (accueil)

- Salutation courte + résumé en une phrase : « 3 posts à valider, 2 publications aujourd'hui, 1 relais n'a pas confirmé. »
- Cartes : **À valider** (liste, bouton « Tout voir »), **Aujourd'hui et demain** (timeline des publications et missions), **Points d'attention** (échec de publication, lien YouTube manquant à J-1, relais sans confirmation, vidéo associée du Short pas encore cochée), **Campagnes en cours** (progression publiés / total).
- Premier lancement (aucune campagne) : état vide accueillant avec 3 choix : **Créer une campagne**, **Importer un Excel**, **Télécharger le modèle Excel**.

### 8.4 Liste des campagnes

- Vue cartes (par défaut) ou tableau. Filtres par statut (Brouillon, En cours, Terminée, Archivée) et recherche.
- Chaque campagne : nom, dates, pastille de statut, **barre de progression**, canaux utilisés (icônes), prochaine publication.
- Menu « … » : **Renommer** (en place, Entrée valide, Échap annule), **Dupliquer** (avec option « décaler les dates à partir du… »), **Exporter en Excel**, **Archiver** (toast avec Annuler), **Supprimer** (seulement pour un brouillon ; confirmation).
- Les brouillons affichent « Reprendre » qui rouvre l'assistant à l'étape où on s'était arrêté.

### 8.5 Création de campagne : l'assistant

Un assistant **en 4 étapes**, avec barre de progression cliquable, **enregistré en brouillon automatiquement dès la première saisie**. On peut le quitter à tout moment et le reprendre.

1. **L'essentiel** : nom (suggestion auto « Campagne [mois] »), marque (pré-remplie), date de début, date de fin (optionnelle), objectif en une phrase. Aide contextuelle courte sous chaque champ.
2. **Le brief** : cible, message clé, appel à l'action, contenu principal. Bouton **« M'aider à écrire le brief »** : l'IA pose 3 questions simples puis rédige un brief que l'on peut modifier. Exemple de bon brief repliable.
3. **Le planning**, trois chemins présentés en cartes :
   - **Importer un fichier Excel** : zone de dépôt + bouton bien visible **« Télécharger le modèle »** (modèle pré-rempli avec les comptes et relais de la marque, §12). Mène au flux d'import (§8.8) ;
   - **Laisser l'IA proposer un planning** : à partir du brief, des dates et des contenus, l'IA propose une grille (jours, canaux, formats, sujets) affichée en aperçu ; on coche / décoche / ajuste avant de valider ;
   - **Partir d'un calendrier vide** : ouvre directement le calendrier de la campagne.
4. **Récapitulatif** : nombre de posts par canal, missions relais, contenus sans média, posts sans texte. Actions : **« Rédiger les textes avec l'IA »** (tous les posts vides, barre de progression, annulable), **« Enregistrer en brouillon »**, **« Ouvrir la campagne »**.

Boutons secondaires toujours présents : « Enregistrer et quitter », « Retour ». Aucun champ bloquant sauf le nom.

### 8.6 Page campagne

- **En-tête** : nom **modifiable en place** (clic → champ), pastille de statut, dates, progression, avatars des relais. Action principale contextuelle :
  - brouillon avec des posts non validés → **« Envoyer en validation »** (soumet tous les brouillons complets) ;
  - tous les posts validés → **« Lancer la campagne »** (confirmation qui résume : « 18 posts, 6 kits relais, premier envoi lundi 5 oct. à 09:00 ») ;
  - active → **« Mettre en pause »**.
- **Onglets** : Planning · Contenus · Relais · Activité · Réglages.
- **Planning** : bascule **Calendrier / Liste**. Liste = tableau dense triable (date, canal, format, contenu, statut, relais), sélection multiple et actions en masse (soumettre, valider, décaler de X jours, changer l'heure, supprimer).
- **Contenus** : cartes par contenu (vignette si possible, code, titre, lien média, résumé), avertissement si un contenu utilisé n'a pas de lien. Pour une vidéo YouTube : champ **« Lien YouTube »** (on colle l'URL, l'app extrait l'ID).
- **Relais** : tableau des missions par personne (à venir, envoyé, ouvert, publié, manqué), bouton « Voir le kit », « Renvoyer l'e-mail », « Envoyer un test à moi ».
- **Activité** : journal lisible (« Anne Laure a publié la capsule 6 », « Cem a validé 4 posts »).
- **Réglages** : renommer, dates, brief, archiver, exporter.

### 8.7 Calendrier et éditeur de post

**Calendrier** (FullCalendar, sélecteur de vues maison comme dans Essential) :
- Vues **Mois · Semaine · Liste**. Mémoriser la dernière vue.
- Chaque événement : icône du canal, format, heure, titre court du contenu. **Style par statut** : brouillon = fond clair pointillé ; en revue = contour orange ; validé = fond plein ; publié = coche ; échec = rouge. Contraste du texte calculé (leçon Essential).
- **Glisser-déposer** pour déplacer (heure conservée en vue Mois), toast « Déplacé au mardi 6 oct. — Annuler ».
- **Clic sur un jour vide** → petite fenêtre de création rapide (canal, format, contenu, heure) puis ouverture de l'éditeur.
- Survol → aperçu du texte.

**Éditeur de post** : **panneau latéral** (pas de changement de page), large, fermé par Échap, navigation post précédent / suivant (J / K).
- Colonne gauche : canal et compte (ou relais auteur), date et heure, format, contenu lié, sujet/angle, **texte**, champs YouTube (titre, description, tags, « Lien vers » la vidéo longue, case « vidéo associée ajoutée dans Studio »), relais qui relaient ce post.
- Colonne droite : **aperçu réaliste** du post LinkedIn (avatar, nom, texte coupé avec « …voir plus » au bon endroit — environ 210 caractères sur desktop, à confirmer visuellement ; média) ou du Short / de la vidéo YouTube (titre, description).
- **Compteurs** : LinkedIn 3 000 caractères, titre YouTube 100, description YouTube 5 000. Alerte douce avant la limite.
- **Panneau IA** : « Générer 3 propositions » (streaming, cartes côte à côte, « Utiliser celle-ci »), actions rapides (Plus court, Plus percutant, Ajouter un appel à l'action, Changer l'accroche, Moins formel), champ libre « Demander une modification ». **Historique des versions** du texte avec retour arrière.
- Commentaires (fil sous le post), historique d'activité du post.
- Barre d'action en bas : statut + action principale (« Soumettre », « Valider », « Refuser… »). **⌘/Ctrl + Entrée** = action principale.

### 8.8 Import Excel

Accessible depuis l'assistant, la page campagne, la liste des campagnes et ⌘K.

1. **Dépôt** : glisser un `.xlsx` ou cliquer. Lien « Télécharger le modèle » juste à côté. Taille max 5 Mo.
2. **Lecture** (quelques secondes, indicateur de progression). Si le fichier suit le modèle → étape 4. Sinon → étape 3.
3. **Correspondance des colonnes** (Excel libre, comme l'ancien plan LDDLT) : l'IA propose « Colonne “Canal” → Réseau », etc. L'utilisateur confirme ou corrige avec des listes déroulantes. Les valeurs inconnues (« Anne Laure ») sont rapprochées d'un relais ou d'un compte existant, ou proposées à la création.
4. **Aperçu** : les posts dans un **mini-calendrier + tableau**. Les lignes en erreur sont surlignées avec un message clair et **corrigeables sur place** (« Jour “Lundii” inconnu », « Contenu CAP9 absent de l'onglet Contenus », « Compte “Shorts” inconnu : choisir… »). Avertissements non bloquants (heure manquante → 09:00 par défaut).
5. **Import** : bouton « Créer 18 posts » → résumé (créés, ignorés) + proposition « Rédiger les textes vides avec l'IA ».
- Importer dans une campagne existante : choisir **Ajouter** ou **Remplacer les brouillons** (jamais les posts validés ou publiés).
- Tout est **transactionnel** : soit tout est créé, soit rien.

### 8.9 Relais et kit du jour

**Gestion des relais** (Réglages de la marque › Relais) :
- Ajout en 10 secondes : **prénom, nom, e-mail** (obligatoires : prénom et e-mail), puis optionnel : poste, profil LinkedIn, ton, exemples de posts (pour personnaliser les textes). Import CSV possible.
- Liste avec recherche, statistiques simples par personne (missions faites / reçues).

**E-mails** (rendus par l'app en React Email, envoyés par n8n) :
- **J-1** (à `Brand.missionD1Hour`, défaut 18:00) : « Demain, vous publiez la capsule 6 » + aperçu du texte + bouton « Voir mon kit ». Pas d'e-mail J-1 si la mission est créée moins de 24 h avant.
- **Jour J** : pour une mission **Poster**, à l'heure prévue ; pour une mission **Relayer**, dès que le post de la page est publié (pour contenir le vrai lien). Bouton principal « Ouvrir mon kit », le texte complet dans l'e-mail pour ceux qui n'ouvrent pas la page, les 4 étapes résumées.
- **Relance** à J+1 si pas de confirmation. **Alerte** au créateur de la campagne à J+2.
- Design : aux couleurs de la marque, lisible sur mobile, version texte brut incluse, objet court et concret.

**Page kit du jour** `/kit/[token]` — publique, sans connexion, sans cookie, **pensée d'abord pour le téléphone** :
- En-tête marque + « Bonjour Anne Laure, voici votre publication du mercredi 7 octobre ».
- **Aperçu** du post tel qu'il apparaîtra.
- Boutons larges : **Copier le texte** (retour « Copié ✓ »), **Télécharger la vidéo** (ou ouvrir le lien Frame.io), **Ouvrir LinkedIn** (sur mobile, ouvre l'app si installée ; lien de partage pré-rempli à tester, sinon simple ouverture du fil).
- **La démarche en 4 étapes** numérotées : coller le texte, ajouter la vidéo, taguer @IT for Business, publier.
- Mission **Relayer** : lien du post de la page, 2 ou 3 commentaires proposés (chacun copiable), texte court de republication.
- Bouton **« C'est publié »** : champ pour coller l'URL de son post (validation : domaine linkedin.com), remerciement chaleureux ensuite.
- Le texte est modifiable localement avant copie (la personne peut ajuster).
- Lien expiré ou mission annulée : message clair et humain, contact de l'équipe.

### 8.10 Design visuel et animations

- **Tokens** dans `globals.css` (variables CSS) : couleurs neutres, accent = couleur de la marque active (contrôle du contraste, repli sur un bleu si illisible), statuts (brouillon gris, revue ambre, validé bleu, publié vert, échec rouge), rayons 8 px / 12 px, ombres légères, espacements échelle de 4.
- **Thème clair par défaut + thème sombre** (suivre le système, bascule manuelle mémorisée).
- **Typographie** Inter ; tailles 13/14/16/20/24/32 ; chiffres tabulaires dans les tableaux.
- **Animations** Framer Motion : 150–250 ms, `ease-out`, ouverture des panneaux, apparition des cartes, réordonnancement. Respecter `prefers-reduced-motion`. Jamais d'animation qui ralentit une action.
- **Chargements** : squelettes (pas de spinner plein écran), mises à jour optimistes avec retour arrière en cas d'erreur, `Suspense` et streaming RSC.
- **Illustrations** d'états vides simples et cohérentes (SVG monochromes).

### 8.11 Textes de l'interface (microcopy)

- **Vouvoiement** partout (des clients et des relais utilisent l'outil). Ton chaleureux, direct, sans jargon (« publication » plutôt que « post » dans les e-mails aux relais).
- Boutons = verbe d'action précis (« Lancer la campagne », pas « OK »).
- Messages d'erreur : ce qui s'est passé + quoi faire (« Le fichier n'a pas pu être lu. Vérifiez qu'il s'agit d'un .xlsx, ou téléchargez le modèle. »).
- Tous les textes dans `src/lib/copy/` (un fichier par domaine), pas de chaînes éparpillées.

### 8.12 Checklist « écran terminé »

- [ ] Action principale évidente, états vide / chargement / erreur / succès traités
- [ ] Aucune saisie perdue (autosave ou garde de sortie)
- [ ] Actions destructrices annulables
- [ ] Clavier : tout est accessible, focus visible, Échap ferme, ⌘/Ctrl + Entrée valide
- [ ] Accessibilité WCAG 2.1 AA : contrastes, labels, `aria-*`, lecteurs d'écran sur les composants custom
- [ ] Responsive : desktop 1280+ soigné, tablette correct ; **validation, commentaires et kit parfaits sur mobile**
- [ ] Thème clair et sombre vérifiés
- [ ] Textes relus, vouvoiement, pas de jargon
- [ ] Captures Playwright desktop + mobile relues

---

## 9. Authentification et sécurité

### 9.1 Connexion
- **Équipe ChoYou** : **Google** (Auth.js Google provider), limité au domaine `choyou.fr` (`hd` + contrôle serveur de l'e-mail). Un bouton, pas de mot de passe.
- **Clients** : **lien magique par e-mail** (Auth.js Email provider via Resend), sur invitation uniquement (un e-mail inconnu ne crée pas de compte).
- Page de connexion simple et soignée : logo, un bouton Google, un champ e-mail « Recevoir un lien de connexion », message de confirmation clair (« Un lien vous attend dans votre boîte mail, valable 24 h »).

### 9.2 Invitations
- Un admin invite par e-mail avec un rôle. L'invité reçoit un e-mail, un clic le connecte et l'amène sur la marque.

### 9.3 Sessions
- Sessions en base (Prisma Adapter), 30 jours glissants, cookies §5. Déconnexion depuis le menu profil. Déconnexion forcée si `isActive = false`.

### 9.4 Liens de kit (relais)
- Token **signé HMAC-SHA256** (`KIT_SIGNING_SECRET`) contenant `missionId` + expiration (7 jours après la date du post), encodé base64url. Pas de stockage du token ; révocation via le statut de mission.
- `robots: noindex`, pas de cookie, rate limit par IP.

### 9.5 API n8n
- `/api/n8n/*` : header `X-N8N-Token` obligatoire (comparaison `timingSafeEqual`), payloads validés par Zod, réponses JSON typées, idempotence (§11).

### 9.6 Divers
- Rate limit (mémoire ou Postgres) sur : magic link, kit, `/api/n8n/*`, génération IA.
- Chiffrement AES-256-GCM des tokens OAuth (lot 4).
- Logs structurés (JSON) sans données personnelles inutiles ; jamais de token dans les logs.
- Plafond de dépense IA : compteur de générations par marque et par jour (`AI_DAILY_LIMIT_PER_BRAND`), message clair si atteint.
- RGPD : données des relais limitées au nécessaire, suppression d'un relais = suppression de ses données personnelles (les missions passées gardent le prénom seulement).

---

## 10. IA : génération des textes

### 10.1 Contexte empilé (dans cet ordre)
1. **Marque** : ligne éditoriale, ton, à faire, à éviter, exemples de posts, hashtags, appel à l'action par défaut, compte à mentionner, instructions supplémentaires.
2. **Campagne** : objectif, cible, brief, dates clés, contenu principal.
3. **Contenu** : type, titre, résumé / message clé, durée.
4. **Post** : canal, format, date, sujet / angle, lien vers un autre contenu.
5. **Relais** (mission) : prénom, poste, ton, exemples → variante personnelle, jamais identique au post de la page ni aux autres relais.

### 10.2 Règles par canal (dans le prompt, surchargées par la marque)
- **LinkedIn** : accroche forte dans les 2 premières lignes (visible avant « voir plus »), paragraphes courts, 3 à 5 hashtags en fin, un seul appel à l'action, pas de lien externe dans le corps sauf demande (lien en commentaire à la place), longueur cible 600–1 300 caractères.
- **Short YouTube** : titre ≤ 70 caractères percutant, description courte avec `#Shorts` et le lien de la vidéo longue.
- **Vidéo longue** : titre ≤ 70 caractères, description structurée (résumé, chapitres si fournis, liens), 5 à 10 tags.
- **Relayer** : 2–3 commentaires courts et naturels (pas de flatterie creuse), et un texte de republication de 1–3 phrases.

### 10.3 Technique
- `streamText` pour l'édition interactive ; `generateObject` + schéma Zod pour les variantes, le planning proposé et la correspondance de colonnes.
- Réponses en **français**, sans guillemets parasites, sans emojis si la marque les interdit.
- Enregistrer le prompt effectif dans `Post.aiPromptUsed`.
- Génération en masse (« Rédiger tous les textes ») : file côté serveur, concurrence limitée (3), progression visible, reprise en cas d'erreur, annulable.
- **Réglages de la marque › Prompt** : formulaire guidé par sections (pas un grand champ vide), avec exemples, et un bac à sable **« Tester »** qui génère un post d'essai à droite.
- Jamais de publication d'un texte IA sans validation humaine.

---

## 11. Contrats avec n8n

Tous les endpoints : `X-N8N-Token`, JSON, Zod, idempotents. Les workflows n8n sont construits à part (MCP n8n), en respectant les conventions ChoYou : emoji + nom clair, nodes nommés `Réseau - Action` (ex. `LinkedIn - Publier Post`, `YouTube - Statut Vidéo`, `App - Retour Statut`, `Gmail - Envoyer Kit`).

| Workflow n8n | Déclencheur | Endpoints |
| --- | --- | --- |
| `📤 Publication Campagnes` (lot 4) | toutes les 5 min | `GET /api/n8n/posts/due`, `POST /api/n8n/posts/result` |
| `✅ Validation Post - Telegram` | webhook appelé par l'app au passage en revue | app → `N8N_VALIDATION_WEBHOOK_URL` ; n8n → `POST /api/n8n/posts/decision` |
| `📧 Relais Équipe` | toutes les 15 min | `GET /api/n8n/missions/due`, `POST /api/n8n/missions/sent` |
| `🎬 Suivi YouTube` | toutes les heures | `GET /api/n8n/youtube/watch`, `POST /api/n8n/youtube/status` |
| `🚨 Alerte Publication` | appelé par les autres | Telegram |

Formats (à implémenter tels quels, types partagés dans `src/server/n8n/contracts.ts`) :

```ts
// GET /api/n8n/posts/due  → pose lockedAt + status PROCESSING dans la même transaction
type DuePost = {
  postId: string; brand: string; campaign: string;
  platform: "LINKEDIN"; authorUrn: string; accessToken: string;
  text: string; media?: { type: "VIDEO" | "IMAGE" | "DOCUMENT"; url: string; title?: string };
  scheduledAt: string; attempt: number;
};

// POST /api/n8n/posts/result
type PostResult = { postId: string; success: boolean; externalId?: string; publishedUrl?: string; error?: string };
// succès → PUBLISHED ; échec → attempts+1, retour APPROVED (retry) ou FAILED au 3e + alerte

// POST /api/n8n/posts/decision
type Decision = { postId: string; decision: "APPROVE" | "REJECT"; validatorEmail: string; reason?: string };

// GET /api/n8n/missions/due  → e-mails à envoyer maintenant, pose sendingLockAt (10 min)
type DueEmail = {
  missionId: string; kind: "D1" | "D0" | "REMINDER" | "ESCALATION";
  to: string; toName: string; replyTo?: string;
  subject: string; html: string; text: string;
};

// POST /api/n8n/missions/sent
type MissionSent = { missionId: string; kind: DueEmail["kind"]; success: boolean; error?: string };

// GET /api/n8n/youtube/watch  → posts STUDIO validés avec youtubeVideoId, entre J-2 et J+1
type YoutubeWatch = { postId: string; videoId: string; scheduledAt: string };

// POST /api/n8n/youtube/status
type YoutubeStatus = { postId: string; privacyStatus: "private" | "unlisted" | "public"; publishedAt?: string };
// public → post PUBLISHED, et déclenche les e-mails J des missions RELAY liées
```

Règles de calcul des e-mails dus :
- **D1** : mission `PLANNED`, post `APPROVED`, campagne `ACTIVE`, maintenant ≥ veille à `missionD1Hour` (heure de la marque) et post créé > 24 h avant.
- **D0 Poster** : maintenant ≥ `scheduledAt`. **D0 Relayer** : post de la page `PUBLISHED`.
- **REMINDER** : pas `DONE` 24 h après le D0. **ESCALATION** : pas `DONE` 48 h après, destinataire = créateur de la campagne ; mission → `MISSED`.

---

## 12. Excel : modèle, import, export

Le modèle de référence est dans `docs/templates/modele-campagne.xlsx` (fourni par Cem, construit sur la campagne LDDLT). **Le modèle téléchargé depuis l'app est généré à la volée avec exceljs** et reprend exactement cette structure, pré-remplie avec les comptes et relais de la marque active.

**Onglets et colonnes** (noms exacts, l'import s'appuie dessus) :

- `Lisez-moi` : mode d'emploi, code couleur (jaune = à remplir, gris = calculé, bleu = rempli par l'app), modes de publication.
- `Campagne` (colonne A = champ, B = valeur) : Marque · Nom de la campagne · Date de début (lundi S1) · Objectif · Cible · Brief pour l'IA · ID de la vidéo principale.
- `Contenus` : ID · Type · Titre · Lien média (Frame.io, Drive…) · Durée · Résumé / message clé (pour l'IA) · Lien YouTube (une fois en ligne).
- `Planning` : Semaine · Jour · Date *(formule)* · Heure · Compte · Réseau *(formule)* · Mode *(formule)* · Format · ID contenu · Titre du contenu *(formule)* · Lien vers (ID ou URL) · Sujet / angle · Texte du post (vide = IA) · Relayé par (noms, virgules) · Statut · Lien publié.
- `Relais` : Prénom · Nom · E-mail · Poste · URL profil LinkedIn · Ton / style (pour l'IA) · Nom dans le planning *(formule)*.
- `Listes` : Jours + décalage ; Comptes (Compte, Réseau, Type, Mode de publication) ; Formats ; Types de contenu ; Réseaux.

Listes déroulantes : Jour, Compte, Format, ID contenu, Type ; Mode = `Auto | Studio | Relais` (« Relais » dans l'Excel = `KIT` d'un profil personnel dans l'app).

**Règles d'import** :
- Lire les **valeurs** (formules recalculées ou recalculées par l'app : ne pas faire confiance aux cellules calculées vides), ignorer les lignes vides.
- Date = calculée depuis Semaine + Jour + Date de début (§6.4) ; si une vraie date est saisie, elle prime.
- Heure vide → 09:00 (avertissement).
- Compte = compte de la marque (post publié par le compte) **ou** relais (mission `POST`, `authorContributorId`).
- « Relayé par » → une mission `RELAY` par nom reconnu.
- Texte fourni → `bodySource = IMPORTED` ; vide → `EMPTY` (à rédiger par l'IA).
- Statut « Publié » + lien → post importé `PUBLISHED` (historique).
- Correspondance tolérante : casse, accents, espaces (« ITforBusiness » = « IT for Business »), avec confirmation si ambigu.

**Export** : même structure, statuts et liens publiés remplis par l'app (reporting client).

---

## 13. Tests et qualité

- **Vitest** : parseur d'import (modèle + Excel libre LDDLT d'origine en fixture), calcul des dates (dont changements d'heure), machine à états, droits (`requireBrandRole`), calcul des e-mails dus, signature/expiration des tokens de kit, rendu des e-mails.
- **Playwright e2e** : connexion (mock), assistant de campagne complet avec reprise d'un brouillon, import du modèle LDDLT, édition + validation d'un post, glisser-déposer calendrier, kit du jour sur mobile avec « C'est publié ».
- **Captures** Playwright des écrans clés dans `tests/screenshots/` (desktop + mobile, clair + sombre).
- Scripts : `npm run check` (= lint + typecheck + tests unitaires), `npm run e2e`.
- Seed (`npm run db:seed`) : marque IT for Business (couleur, prompt d'exemple), comptes « IT for Business » (LinkedIn, mode KIT en V1) et « IT for Business YouTube » (STUDIO), relais Anne Laure, un super admin (Cem), une campagne de démo importée du modèle LDDLT.

---

## 14. Plan de livraison

| Lot | Contenu | Terminé quand… |
| --- | --- | --- |
| **0 – Accès** (en parallèle, par Cem) | App LinkedIn dédiée + demande Community Management API ; projet Google Cloud, API YouTube en lecture | accès validés pour le lot 4 |
| **1 – Socle** | Projet, Docker, déploiement VPS + HTTPS, auth Google + magic link, sessions, marques, rôles, invitations, layout (sidebar, ⌘K, thèmes), campagnes (liste, renommer, dupliquer, archiver), assistant étapes 1-2-4 avec brouillon auto, contenus, posts, calendrier + liste, éditeur de post (sans IA) | une campagne se crée, se reprend et se planifie à la main, en production |
| **2 – Import Excel + IA** | Téléchargement du modèle, import (aperçu, erreurs, correspondance IA), étape 3 de l'assistant, prompt de marque guidé + bac à sable, génération (variantes, actions rapides, en masse), champs YouTube / Shorts | le plan LDDLT est importé et rédigé par l'IA |
| **3 – Validation + Relais = V1 en service** | Soumission, file « À valider » (actions en masse), validation Telegram, commentaires, lancement / pause de campagne, relais (gestion, missions, textes personnalisés), e-mails React Email, endpoints n8n missions + YouTube, page kit, « C'est publié », relance / alerte, page Aujourd'hui complète, export Excel | la campagne LDDLT est menée de bout en bout dans l'outil |
| **4 – Publication automatique** | OAuth LinkedIn dans l'app (tokens chiffrés), R2 + upload médias, endpoints posts n8n, publicateur, retries, alertes ; comptes LinkedIn passent en `AUTO` | les posts de la page partent seuls |
| **5 – Multi-client** | Rôle Client complet, onboarding d'une marque, service d'envoi dédié pour les relais clients (Brevo ou Resend) | un client est ajouté sans code |
| Plus tard | Upload auto des Shorts, publication sur les profils perso, classement des relais | — |

---

## 15. Leçons d'Essential 2.0 (même stack, à appliquer)

- **Neon** : `DATABASE_URL` poolée (hôte `-pooler`, `pgbouncer=true&connection_limit=1`) + `DIRECT_URL` directe. **Utiliser `prisma db push`** (script `db:push`), pas `prisma migrate dev` (la shadow database casse sur Neon : P3014 / P1017). Si on veut des migrations versionnées plus tard, `prisma migrate diff` + `migrate deploy` sur la connexion directe.
- **Prisma 7 (différent d'Essential, qui était en Prisma 6)** : `url` et `directUrl` ne sont plus acceptés dans `schema.prisma` (erreur P1012). Les URLs vont dans `prisma.config.ts` (URL **directe** pour `db push`), et le `PrismaClient` reçoit un driver adapter avec l'URL **poolée** : `@prisma/adapter-neon` (recommandé avec Neon) ou `@prisma/adapter-pg`. Vérifier la doc Prisma de la version installée au lot 1 avant d'écrire `src/server/db.ts`. Le reste du schéma §6.2 a été validé avec le validateur Prisma.
- Neon met la base en veille : erreurs `57P01` transitoires bénignes au réveil → retry automatique sur la première requête.
- **Session relue depuis la base** à chaque requête pour que les changements de rôle s'appliquent sans reconnexion. Préférer des requêtes directes explicites aux relations Prisma ambiguës.
- **FullCalendar** met le texte des événements en blanc par défaut → calculer le contraste (helpers `hexToRgb`, `luminance`, `readableOn`) ; sélecteur de vues **maison** plutôt que les boutons FullCalendar ; page calendrier en pleine largeur.
- Panneau « en attente » avec **sélection multiple et actions en masse** : le reprendre pour « À valider ».
- E-mails : le module d'envoi se désactive proprement sans clé (log seulement) en dev.

---

## 16. Points ouverts (demander à Cem avant le lot concerné)

1. Reverse proxy déjà en place sur le VPS pour n8n (Traefik, Nginx, Caddy ?) et création du DNS `campaign.choyou-tools.fr`. — lot 1
2. Clé Resend et domaine d'envoi vérifié. — lot 1
3. Adresse Gmail utilisée par n8n pour les e-mails aux relais (ex. `campaign@choyou.fr`). — lot 3
4. Qui reçoit le kit pour publier sur la page IT for Business en attendant le lot 4. — lot 3
5. E-mail d'Anne Laure et liste des autres relais. — lot 3
6. ~~Heure d'envoi J-1 (18:00 par défaut) et heure de publication par défaut (09:00).~~ **Décidé (24/09/2026)** : 18:00 et 09:00.
7. Logo et couleur d'IT for Business. — lot 1
8. ~~Modèle IA : rester sur `gpt-4o-mini` ou passer sur Claude pour la rédaction.~~ **Décidé (24/09/2026)** : Claude Sonnet 5 (`claude-sonnet-5`), clé `ANTHROPIC_API_KEY`. Le code reste indépendant du fournisseur.

---

## 17. Variables d'environnement

```
# App
AUTH_URL=https://campaign.choyou-tools.fr
AUTH_SECRET=
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ALLOWED_GOOGLE_DOMAIN=choyou.fr

# Base (Neon)
DATABASE_URL=      # poolée
DIRECT_URL=        # directe

# E-mails app (magic links)
RESEND_API_KEY=
EMAIL_FROM="Campaign · ChoYou <campaign@choyou.fr>"

# IA
ANTHROPIC_API_KEY=
ANTHROPIC_WORKSPACE_ID=        # seulement pour une clé d'organisation non rattachée à un workspace
AI_MODEL=claude-sonnet-5
AI_DAILY_LIMIT_PER_BRAND=300

# n8n
N8N_API_TOKEN=                 # header X-N8N-Token
N8N_VALIDATION_WEBHOOK_URL=

# Sécurité
KIT_SIGNING_SECRET=
ENCRYPTION_KEY=                # 32 octets base64 (lot 4)

# Médias (lot 4)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=

# LinkedIn (lot 4)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_API_VERSION=          # YYYYMM, header Linkedin-Version
```

Fournir un `.env.example` à jour (sans valeurs). Valider les variables au démarrage avec Zod (`src/env.ts`) : l'app refuse de démarrer avec un message clair s'il en manque une.

---

## 18. Organisation du code

```
src/
  app/
    (auth)/connexion/
    (app)/[brandSlug]/
      aujourdhui/
      campagnes/            liste, nouvelle/ (assistant), [campaignId]/
      calendrier/
      a-valider/
      relais/
      reglages/             marque, prompt, comptes, accès
    kit/[token]/            page publique relais
    api/
      auth/[...nextauth]/
      n8n/                  endpoints §11
      health/
      templates/campagne/   téléchargement du modèle Excel
    confidentialite/  mentions-legales/
  components/
    ui/                     shadcn
    layout/  calendar/  post-editor/  wizard/  import/  kit/  empty-states/
  server/                   logique métier (pas d'import côté client)
    auth/  permissions.ts
    campaigns/  posts/transitions.ts  missions/  import/  export/  ai/  n8n/contracts.ts  email/
  emails/                   templates React Email
  lib/                      dates.ts, copy/, utils, validations (zod)
  env.ts
prisma/  schema.prisma  seed.ts
docs/    templates/modele-campagne.xlsx
tests/   unit/  e2e/  fixtures/ (plan LDDLT d'origine + modèle)  screenshots/
```

- Server Actions dans `actions.ts` à côté des pages ; elles valident (Zod), vérifient les droits, appellent `src/server/*`, renvoient `{ ok, data } | { ok: false, error }` (jamais d'exception non gérée vers l'UI).
- Composants serveur par défaut ; `"use client"` seulement là où il faut de l'interactivité.

---

## 19. État d'avancement

- [ ] Lot 1 — Socle : **code terminé et testé (24/09/2026), mise en production en attente** des accès (voir « Reste à faire »)
- [x] Lot 2 — Import Excel + IA : terminé le 24/09/2026 (tests avec IA simulée + essai réel de Sonnet 5 validé), à mettre en production avec le lot 1
- [ ] Lot 3 — Validation + Relais (V1 en service)
- [ ] Lot 4 — Publication automatique
- [ ] Lot 5 — Multi-client

*(Mettre à jour à la fin de chaque lot : ce qui est fait, décisions prises, écarts par rapport à ce fichier.)*

### Lot 1 — bilan (24/09/2026)

**Fait** (dépôt git créé le 24/09/2026 : tout le lot 1 est dans un seul commit initial, pas d'historique antérieur) : projet Next.js + Tailwind/shadcn, schéma Prisma, auth Google @choyou.fr + lien magique (sessions en base 30 j), droits §7, invitations, shell (sidebar repliable, sélecteur de marque, ⌘K, thème clair/sombre/système), réglages de marque (général avec autosave, comptes, accès, relais minimal), création de marque, liste des campagnes (cartes/tableau, filtres, renommer en place, dupliquer avec décalage, archiver + Annuler, supprimer un brouillon), assistant 4 étapes avec brouillon auto et reprise, page campagne (en-tête, Planning, Contenus, Activité, Réglages), calendrier FullCalendar + liste (glisser-déposer, création rapide, actions en masse, tout annulable), calendrier de la marque, éditeur de post en panneau latéral (aperçus LinkedIn/YouTube, compteurs, J/K, Échap, ⌘/Ctrl+Entrée), page Aujourd'hui, seed, pages légales, Dockerfile + Compose Caddy + runbook (`deploy/`).

**Qualité** : `npm run check` vert (lint, types, 130+ tests Vitest : dates et changements d'heure, machine à états, droits, couleurs, YouTube, invitations…). `npm run e2e` : 17 tests Playwright verts (desktop + mobile, contrôles axe WCAG 2.1 AA). `npm run screenshots` : 20 écrans × 1440/390 px × clair/sombre dans `tests/screenshots/`. Image Docker vérifiée en local (saine, non root, en-têtes de sécurité).

**Versions** : Next 16.3.6 (le middleware s'appelle `proxy.ts`), React 19.3, next-auth 5.0.0-beta.32 (v5 jamais sortie de beta, épinglée), Prisma 7.10.0 (le tag npm `latest` pointait sur une 8.0 RC, écartée), FullCalendar 6.1.21, Tailwind 4, Zod 4.

**Écarts par rapport à ce fichier (validés au plan du lot 1)** :
- Prisma : générateur `prisma-client` (sortie `src/generated/prisma`), URLs dans `prisma.config.ts` (directe) et `src/server/db.ts` (poolée, adaptateur Neon ; adaptateur `pg` si l'URL pointe sur un Postgres local).
- Schéma : modèle `Invitation` (jeton haché SHA-256, 7 jours) ; `deletedAt` sur `Post` et `Content` (suppression annulable) ; `@default([])` sur les listes ; `Campaign.keyMessage` et `Campaign.callToAction` (champs de l'étape 2 du §8.5, absents du §6.2).
- `Campaign.wizardStep = 5` signifie « assistant terminé » (1 à 4 = étape en cours).
- Tout compte Google @choyou.fr peut se connecter ; `isSuperAdmin` n'est donné qu'explicitement (seed pour Cem). Un compte sans marque voit un écran « demandez l'accès ».
- Lot 1 : un post LinkedIn de page est en mode `KIT`, un post YouTube en `STUDIO` (`AUTO` arrive au lot 4). Un relais publie depuis son profil LinkedIn.
- Étape 3 de l'assistant : seule la carte « Partir d'un calendrier vide » au lot 1. Import, IA, « À valider », menu Relais et export sont masqués jusqu'à leur lot.
- Dépendances ajoutées hors §3 (validées) : internes de shadcn (`radix-ui`, `class-variance-authority`, `cn`, `tw-animate-css`, `shadcn` en dev), `server-only`, `tsx`, `@axe-core/playwright`, `@prisma/adapter-pg` (cité au §15). Pas de `next-themes` (thème par cookie).
- e2e sur une base Postgres locale Docker (`docker-compose.dev.yml`, base `campaign_e2e`) plutôt qu'une branche Neon. `EMAIL_TRANSPORT=log` n'existe que pour ces tests (refusé si `AUTH_URL` est en https).
- CSP : `style-src 'unsafe-inline'` (FullCalendar, Framer Motion) et `font-src data:` (police d'icônes de FullCalendar).

**Reste à faire pour clore le lot 1 (mise en production)** — côté Cem :
1. Couleur hex et logo d'IT for Business (`docs/brand/`) ; puis `SEED_BRAND_COLOR` au seed de prod.
2. Neon (projet `campaign`, Francfort, branches `main` et `dev`) : URLs poolée + directe.
3. Google Cloud : client OAuth (écran « Interne »), redirections localhost et production.
4. Resend : domaine `choyou.fr` (UE), enregistrements DNS, clé « Sending access ».
5. DNS `campaign.choyou-tools.fr` → VPS, accès SSH ; inspection du proxy existant avant de choisir Caddy ou le proxy en place.
6. Informations des mentions légales (`src/lib/copy/legal.ts`, valeurs « à compléter »).
Puis : déploiement selon `deploy/RUNBOOK.md`, vérification HTTPS/en-têtes, connexion Google réelle, parcours complet en production.

**Points ouverts restants** (§16) : 3, 4, 5 (lot 3). Les points 6 et 8 sont tranchés (24/09/2026). Anne Laure est seedée avec l'adresse provisoire `anne-laure@example.invalid`.

### Lot 2 — bilan (24/09/2026)

**Fait** (commits `chore: add Anthropic SDK…` à `feat: AI in the campaign wizard…`) :
- **Socle IA** (`src/server/ai/`) : client Claude unique (streaming + sorties structurées, erreurs traduites en français), assemblage du prompt pur et testé (§10.1-10.2 : marque dans le prompt système, mis en cache par marque ; campagne, contenu, post, relais dans le message), quota quotidien par marque (compteur atomique `AiUsage`, jour local de la marque) + limite de rafale par utilisateur, route de streaming `POST /api/ai/post`.
- **Réglages › Prompt IA** : formulaire guidé (ligne éditoriale, ton, à faire / à éviter, hashtags en puces, CTA, compte à mentionner, exemples, instructions), autosave, bac à sable « Tester » qui utilise le prompt tel qu'il est à l'écran.
- **Éditeur** : « Générer 3 propositions » (3 flux en parallèle, accroches différentes), retouches rapides, demande libre, propositions YouTube (titre, description, tags), **historique des versions** (`PostVersion` : textes IA, sessions d'édition humaine fusionnées sur 10 min, texte importé d'origine conservé) avec retour à une version. Rien n'est remplacé sans clic ; un post validé demande toujours confirmation. L'aperçu reste visible pendant le défilement.
- **Excel** : modèle généré par exceljs (`GET /api/templates/campagne?marque=…`, même structure que `docs/templates/`, pré-rempli avec comptes et relais), import du modèle (lecture des valeurs, dates recalculées, correspondance tolérante, erreurs corrigeables sur place, lignes ignorables, « Ajouter » / « Remplacer les brouillons », transaction unique), **Excel libre** avec correspondance des colonnes proposée par l'IA puis interprétation des valeurs (l'Excel LDDLT d'origine s'importe en 18 posts sans erreur). Points d'entrée : liste des campagnes, planning, ⌘K, page Aujourd'hui (premier lancement), assistant.
- **Assistant** : « M'aider à écrire le brief » (3 questions → brief, avec Annuler), étape 3 à trois cartes (Importer / Laisser l'IA proposer un planning / Calendrier vide), rédaction en masse à l'étape 4.
- **Rédaction en masse** : depuis la page (3 en parallèle), progression, Arrêter, reprise (seuls les posts encore vides), arrêt propre à la limite quotidienne.

**Qualité** : `npm run check` vert (170 tests Vitest : prompt, client simulé, quota, versions, normalisation, modèle LDDLT, aller-retour export → import, changement d'heure du 25/10, Excel libre). `npm run e2e` : 132 tests Playwright verts (dont import modèle, correction sur place, Excel libre, éditeur IA, prompt + bac à sable, assistant IA complet, rédaction en masse), contrôles axe WCAG 2.1 AA. Nouvelles captures : 05b, 08b, 13b, 21, 21b, 22.

**Écarts par rapport à ce fichier (validés au plan du lot 2)** :
- SDK officiel Anthropic au lieu du Vercel AI SDK ; `ANTHROPIC_API_KEY` (+ `ANTHROPIC_WORKSPACE_ID` facultatif) remplace `OPENAI_API_KEY` ; modèle Claude Sonnet 5.
- Rédaction en masse pilotée depuis la page (concurrence 3), pas de file côté serveur.
- Schéma : `PostVersion`, `AiUsage`, `ImportJob.payload` ; code d'erreur applicatif `UNAVAILABLE`.
- `AI_TRANSPORT=mock` réservé aux e2e (refusé en https), comme `EMAIL_TRANSPORT=log`. Les heuristiques de `src/lib/import/free.ts` servent de repli quand l'IA est indisponible (et de mock).
- Le « Mode » d'un compte dans l'Excel affiche aussi « Kit » (page LinkedIn publiée avec un kit en attendant le lot 4), expliqué dans l'onglet Lisez-moi.
- Import : un relais inconnu nommé dans le planning n'est créé que par un administrateur de la marque et seulement avec son e-mail ; un planning proposé par l'IA passe par exactement les mêmes contrôles et la même transaction qu'un import.
- Dépendances ajoutées : `@anthropic-ai/sdk` 0.128.0, `exceljs` 4.4.0 (alerte `npm audit` modérée sur `uuid`, fonctions v3/v5/v6 non utilisées par exceljs).

**Essai réel (24/09/2026)** : `scripts/ai-smoke.ts` (post LDDLT + Short) et `scripts/ai-schemas-smoke.ts` (correspondance de colonnes, interprétation, planning) passent sur Sonnet 5 (~5 s par post, premier mot à ~1 s). Il a révélé trois points corrigés (commit `fix: harden AI outputs…`) : noms de comptes renvoyés avec « (LinkedIn) » par le planning, codes vides dans l'interprétation, titres internes (« Capsule 1 ») cités dans les posts. Relancer ces deux scripts après toute modification des prompts.
