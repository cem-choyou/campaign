export const todayCopy = {
  title: "Aujourd'hui",
  greeting: (name: string | null, hour: number) => {
    const hello = hour < 18 ? "Bonjour" : "Bonsoir";
    return name ? `${hello} ${name}` : hello;
  },
  summary: (today: number, tomorrow: number, missingText: number) => {
    const parts: string[] = [];
    parts.push(
      today === 0
        ? "aucune publication aujourd'hui"
        : `${today} publication${today > 1 ? "s" : ""} aujourd'hui`,
    );
    if (tomorrow > 0) parts.push(`${tomorrow} demain`);
    if (missingText > 0) {
      parts.push(`${missingText} post${missingText > 1 ? "s" : ""} à rédiger cette semaine`);
    }
    const sentence = parts.join(", ");
    return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
  },
  upcoming: {
    title: "Aujourd'hui et demain",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    empty: "Rien de prévu aujourd'hui ni demain.",
    openCalendar: "Ouvrir le calendrier",
  },
  attention: {
    title: "Points d'attention",
    missingText: (n: number) =>
      n === 1
        ? "1 post de la semaine n'a pas encore de texte"
        : `${n} posts de la semaine n'ont pas encore de texte`,
    missingTextAction: "Rédiger",
    allGood: "Rien à signaler. Tout est prêt pour les prochains jours.",
  },
  campaigns: {
    title: "Campagnes en cours",
    empty: "Aucune campagne en cours.",
    seeAll: "Toutes les campagnes",
    resume: "Reprendre",
  },
  firstRun: {
    title: "Bienvenue sur Campaign",
    body: "Planifiez vos publications LinkedIn et YouTube, faites-les valider et suivez leur mise en ligne. Commencez par créer votre première campagne.",
    create: "Créer une campagne",
  },
} as const;
