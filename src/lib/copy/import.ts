export const importCopy = {
  pageTitle: "Importer un planning Excel",
  pageDescription:
    "Déposez le fichier : Campaign crée les contenus et les posts en brouillon, et l'IA rédigera les textes vides.",
  intoCampaign: (name: string) => `Import dans la campagne « ${name} »`,
  breadcrumb: "Importer un Excel",
  steps: ["Fichier", "Aperçu", "Import"],
  drop: {
    title: "Déposez votre fichier Excel ici",
    body: "ou cliquez pour le choisir (.xlsx, 5 Mo maximum)",
    choose: "Choisir un fichier",
    reading: "Lecture du fichier…",
    templateTitle: "Pas encore de fichier ?",
    templateBody:
      "Téléchargez le modèle : il contient déjà les comptes et les relais de la marque, avec des listes déroulantes.",
    download: "Télécharger le modèle",
  },
  errors: {
    noFile: "Choisissez un fichier .xlsx.",
    tooBig: "Le fichier dépasse 5 Mo. Retirez les onglets inutiles ou les images, puis réessayez.",
    notXlsx:
      "Ce fichier n'est pas un .xlsx. Enregistrez-le au format Excel (.xlsx) ou téléchargez le modèle.",
    unreadable:
      "Le fichier n'a pas pu être lu. Vérifiez qu'il s'agit d'un .xlsx, ou téléchargez le modèle.",
    notTemplate:
      "Ce fichier ne suit pas le modèle Campaign (onglet « Planning » avec les colonnes Semaine, Jour, Compte). Téléchargez le modèle pour y reporter votre planning.",
    tooMany: "Beaucoup d'imports en peu de temps. Patientez quelques minutes.",
    network: "Le fichier n'a pas pu être envoyé. Vérifiez votre connexion et réessayez.",
  },
  preview: {
    title: "Vérifiez avant d'importer",
    summary: (posts: number, missions: number) =>
      `${posts} post${posts > 1 ? "s" : ""}${missions ? ` · ${missions} mission${missions > 1 ? "s" : ""} relais` : ""}`,
    errors: (n: number) => (n === 1 ? "1 erreur à corriger" : `${n} erreurs à corriger`),
    warnings: (n: number) => (n === 1 ? "1 avertissement" : `${n} avertissements`),
    allGood: "Tout est prêt.",
    withText: (n: number, total: number) =>
      n === 0
        ? "Aucun texte fourni : l'IA pourra tous les rédiger."
        : `${n} texte${n > 1 ? "s" : ""} fourni${n > 1 ? "s" : ""}, ${total - n} à rédiger par l'IA.`,
    campaign: "Campagne",
    campaignName: "Nom",
    startDate: "Début (lundi S1)",
    contents: "Contenus",
    contentsCount: (n: number) => (n === 1 ? "1 contenu" : `${n} contenus`),
    newContributors: (names: string) => `Relais ajoutés à la marque : ${names}.`,
    fileIssues: "À propos du fichier",
    calendar: "Calendrier",
    table: "Posts",
    onlyIssues: "Seulement les lignes à corriger",
    columns: {
      row: "Ligne",
      date: "Date",
      time: "Heure",
      publisher: "Compte",
      format: "Format",
      content: "Contenu",
      text: "Texte",
      relays: "Relais",
      status: "État",
    },
    rowLabel: (row: number) => `Ligne ${row}`,
    chooseAccount: "Choisir un compte…",
    chooseContent: "Choisir un contenu…",
    noContent: "Aucun contenu",
    skip: "Ignorer cette ligne",
    unskip: "Réintégrer",
    skipped: "Ignorée",
    ok: "Prêt",
    textProvided: "Fourni",
    textAi: "À rédiger",
    published: "Déjà publié",
    moreIssues: (n: number) => `+ ${n}`,
    empty: "Aucune ligne à corriger.",
  },
  mode: {
    label: "Dans cette campagne",
    add: "Ajouter aux posts existants",
    replace: "Remplacer les brouillons",
    replaceHint: "Les posts validés ou publiés ne sont jamais touchés.",
  },
  submit: (n: number) => (n === 1 ? "Créer 1 post" : `Créer ${n} posts`),
  submitBlocked: "Corrigez les erreurs pour importer.",
  importing: "Import en cours…",
  restart: "Changer de fichier",
  done: {
    title: "Import terminé",
    body: (created: number, skipped: number) =>
      `${created} post${created > 1 ? "s" : ""} créé${created > 1 ? "s" : ""}${skipped ? `, ${skipped} ligne${skipped > 1 ? "s" : ""} ignorée${skipped > 1 ? "s" : ""}` : ""}.`,
    replaced: (n: number) => `${n} brouillon${n > 1 ? "s" : ""} remplacé${n > 1 ? "s" : ""}.`,
    writeWithAi: "Rédiger les textes vides avec l'IA",
    open: "Ouvrir la campagne",
  },
} as const;
