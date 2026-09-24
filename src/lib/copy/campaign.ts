export const campaignCopy = {
  tabs: {
    planning: "Planning",
    contents: "Contenus",
    activity: "Activité",
    settings: "Réglages",
  },
  tabsLabel: "Sections de la campagne",
  addPost: "Ajouter un post",
  archivedBanner:
    "Cette campagne est archivée. Elle ne publie plus rien et n'apparaît plus dans la liste.",
  unarchive: "Désarchiver",
  published: (published: number, total: number) =>
    total === 0 ? "Aucun post" : `${published}/${total} publiés`,
  contents: {
    title: "Contenus",
    description:
      "Chaque média est décrit une seule fois, puis réutilisé par les posts grâce à son code (CAP1, SHORT1…).",
    add: "Ajouter un contenu",
    edit: "Modifier le contenu",
    create: "Ajouter le contenu",
    empty: "Aucun contenu pour le moment",
    emptyBody:
      "Décrivez la vidéo principale, les capsules et les Shorts : les posts s'y rattacheront.",
    code: "Code",
    codeHint: "Court et unique dans la campagne, par exemple CAP1 ou VID-LONG.",
    type: "Type",
    titleField: "Titre",
    mediaUrl: "Lien du média",
    mediaUrlHint: "Frame.io, Google Drive… (le fichier reste où il est).",
    duration: "Durée",
    durationHint: "Au format 1:30.",
    summary: "Résumé / message clé",
    summaryHint: "Sert de contexte pour la rédaction des posts.",
    youtubeUrl: "Lien YouTube",
    youtubeUrlHint: "Collez l'adresse de la vidéo une fois programmée dans YouTube Studio.",
    parent: "Vidéo longue associée",
    parentHint: "Le Short renverra vers cette vidéo.",
    parentNone: "Aucune",
    main: "Contenu principal",
    usedIn: (n: number) =>
      n === 0 ? "Pas encore utilisé" : n === 1 ? "Utilisé par 1 post" : `Utilisé par ${n} posts`,
    missingMedia: "Lien média manquant",
    openMedia: "Ouvrir le média",
    openYoutube: "Voir sur YouTube",
    saved: "Contenu enregistré.",
    deleted: (code: string) => `Le contenu ${code} est supprimé.`,
    delete: "Supprimer",
  },
  activity: {
    title: "Activité",
    description: "Tout ce qui s'est passé sur la campagne, du plus récent au plus ancien.",
    empty: "Aucune activité pour le moment.",
  },
  settings: {
    title: "Réglages de la campagne",
    description: "Modifiez les informations générales. Tout est enregistré automatiquement.",
    wizard: "Rouvrir l'assistant",
    archiveTitle: "Archiver la campagne",
    archiveBody:
      "La campagne disparaît de la liste et ne publie plus rien. Vous pourrez la désarchiver.",
    archive: "Archiver la campagne",
  },
} as const;
