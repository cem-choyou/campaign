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
} as const;
