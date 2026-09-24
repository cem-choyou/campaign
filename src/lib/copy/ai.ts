export const aiCopy = {
  errors: {
    notConfigured: "L'IA n'est pas encore configurée sur ce serveur. Prévenez l'équipe ChoYou.",
    dailyLimit: (limit: number) =>
      `La limite quotidienne de ${limit} générations IA est atteinte pour cette marque. Elle se réinitialise demain matin.`,
    tooFast: "Beaucoup de demandes en peu de temps. Patientez quelques secondes puis réessayez.",
    busy: "L'IA est très sollicitée en ce moment. Réessayez dans un instant.",
    refused: "L'IA n'a pas pu rédiger ce texte. Reformulez la demande ou modifiez le sujet.",
    empty: "L'IA n'a rien renvoyé. Réessayez.",
    failed: "La génération a échoué. Réessayez dans un instant.",
  },
  bulk: {
    open: "Rédiger les textes avec l'IA",
    title: "Rédiger les textes vides avec l'IA",
    description:
      "L'IA rédige chaque post sans texte selon le prompt de la marque et le brief. Rien n'est publié : chaque texte devra être relu et validé.",
    loading: "Recherche des posts sans texte…",
    none: "Tous les posts ont déjà un texte.",
    count: (n: number) => (n === 1 ? "1 post à rédiger." : `${n} posts à rédiger.`),
    start: (n: number) => (n === 1 ? "Rédiger 1 texte" : `Rédiger ${n} textes`),
    progress: (done: number, total: number) => `${done} / ${total}`,
    running:
      "Rédaction en cours… Vous pouvez fermer cette fenêtre : les textes déjà rédigés sont enregistrés.",
    cancel: "Arrêter",
    cancelling: "Arrêt après les textes en cours…",
    done: (n: number) => (n === 1 ? "1 texte rédigé." : `${n} textes rédigés.`),
    stopped: (n: number) =>
      `Rédaction arrêtée : ${n} texte${n > 1 ? "s" : ""} rédigé${n > 1 ? "s" : ""}. Relancez pour continuer : seuls les posts encore vides seront rédigés.`,
    failures: (n: number) =>
      n === 1 ? "1 post n'a pas pu être rédigé." : `${n} posts n'ont pas pu être rédigés.`,
    limit: "La limite quotidienne d'IA est atteinte : la rédaction reprendra demain.",
    close: "Fermer",
  },
} as const;
