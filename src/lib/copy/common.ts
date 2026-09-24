// Shared interface copy (French, "vous"). One file per domain in src/lib/copy/.

export const common = {
  appName: "Campaign",
  actions: {
    save: "Enregistrer",
    cancel: "Annuler",
    undo: "Annuler",
    close: "Fermer",
    back: "Retour",
    next: "Continuer",
    delete: "Supprimer",
    archive: "Archiver",
    rename: "Renommer",
    duplicate: "Dupliquer",
    edit: "Modifier",
    retry: "Réessayer",
    search: "Rechercher",
    seeAll: "Tout voir",
  },
  actionsFor: (name: string) => `Actions pour ${name}`,
  saving: {
    saving: "Enregistrement…",
    saved: "Enregistré",
    error: "Non enregistré. Nouvel essai en cours…",
    leaveWarning:
      "Une sauvegarde est en cours. Quitter la page maintenant peut faire perdre vos dernières modifications.",
  },
  errors: {
    generic: "Une erreur inattendue s'est produite. Réessayez dans un instant.",
    forbidden: "Vous n'avez pas les droits nécessaires pour cette action.",
    notFound: "Cet élément n'existe pas ou a été supprimé.",
    invalid: "Certaines informations sont incomplètes ou incorrectes.",
    network: "La connexion a été interrompue. Vérifiez votre réseau puis réessayez.",
  },
  theme: {
    label: "Thème",
    light: "Clair",
    dark: "Sombre",
    system: "Système",
  },
  footer: {
    privacy: "Confidentialité",
    legal: "Mentions légales",
  },
} as const;

export const postStatusLabels = {
  DRAFT: "Brouillon",
  IN_REVIEW: "En revue",
  APPROVED: "Validé",
  PROCESSING: "En cours d'envoi",
  PUBLISHED: "Publié",
  FAILED: "Échec",
  CANCELLED: "Annulé",
} as const;

export const campaignStatusLabels = {
  DRAFT: "Brouillon",
  ACTIVE: "En cours",
  COMPLETED: "Terminée",
  ARCHIVED: "Archivée",
} as const;

export const roleLabels = {
  ADMIN: "Administrateur",
  VALIDATOR: "Valideur",
  EDITOR: "Éditeur",
  CLIENT: "Client",
} as const;

export const platformLabels = { LINKEDIN: "LinkedIn", YOUTUBE: "YouTube" } as const;

export const publishModeLabels = {
  AUTO: "Automatique",
  STUDIO: "YouTube Studio",
  KIT: "Kit (publication manuelle)",
} as const;

export const postFormatLabels = {
  VIDEO_POST: "Post vidéo",
  SHORT: "Short",
  LONG_VIDEO: "Vidéo longue",
  IMAGE: "Image",
  DOCUMENT: "Document PDF",
  TEXT: "Texte seul",
} as const;

export const contentTypeLabels = {
  LONG_VIDEO: "Vidéo longue",
  CAPSULE: "Capsule",
  SHORT: "Short",
  IMAGE: "Image",
  DOCUMENT: "Document PDF",
} as const;

export const notFoundCopy = {
  title: "Page introuvable",
  body: "Cette page n'existe pas, a été supprimée, ou vous n'y avez pas accès.",
  back: "Revenir à l'accueil",
} as const;
