// Legal pages (§5). Company details are awaited from ChoYou (plan, action G): every value marked
// PENDING must be filled in before going live.

const PENDING = "à compléter";

export const legalEntity = {
  company: `ChoYou — ${PENDING} (raison sociale et forme)`,
  registration: `SIREN ${PENDING}`,
  address: `Adresse du siège : ${PENDING}`,
  publisher: `Directeur de la publication : ${PENDING}`,
  contact: "campaign@choyou.fr",
  host: `Hébergement : ${PENDING} (nom et adresse de l'hébergeur du serveur)`,
};

export const legalCopy = {
  back: "Retour",
  privacy: {
    title: "Confidentialité",
    updated: "Dernière mise à jour : septembre 2026",
    sections: [
      {
        title: "Qui est responsable ?",
        body: [
          `Campaign est l'outil de planification de campagnes de ${legalEntity.company}. Pour toute question sur vos données : ${legalEntity.contact}.`,
        ],
      },
      {
        title: "Quelles données ?",
        body: [
          "Utilisateurs de Campaign : nom, adresse e-mail, photo du compte Google le cas échéant, marques et rôles, historique des actions (qui a créé, modifié ou déplacé quoi).",
          "Relais (collaborateurs qui publient ou relaient) : prénom, nom, adresse e-mail et, s'ils sont fournis, poste et adresse du profil LinkedIn. Les relais n'ont pas de compte.",
        ],
      },
      {
        title: "Pour quoi faire ?",
        body: [
          "Vous connecter, gérer les accès aux marques, planifier et suivre les publications, et envoyer aux relais les informations nécessaires à leurs publications. Aucune donnée n'est vendue ni utilisée à des fins publicitaires.",
        ],
      },
      {
        title: "Combien de temps ?",
        body: [
          "Sessions de connexion : 30 jours glissants. Liens de connexion : 24 heures. Invitations : 7 jours.",
          "Comptes et relais : tant qu'ils sont utiles à la marque. La suppression d'un relais supprime ses données personnelles ; les publications passées ne gardent que son prénom.",
        ],
      },
      {
        title: "Où sont les données ?",
        body: [
          "Base de données chez Neon (Union européenne, Francfort), application sur un serveur dédié. Les e-mails de connexion sont envoyés par Resend (région Union européenne).",
        ],
      },
      {
        title: "Cookies",
        body: [
          "Campaign n'utilise que des cookies strictement nécessaires : la session de connexion, la protection contre les requêtes frauduleuses (CSRF) et vos préférences d'affichage (thème, barre latérale, vue du calendrier et du planning). Aucun cookie de mesure d'audience ni de publicité : aucun consentement n'est donc demandé. Les pages « kit du jour » des relais ne déposent aucun cookie.",
        ],
      },
      {
        title: "Vos droits",
        body: [
          `Vous pouvez accéder à vos données, les faire rectifier ou supprimer, et vous opposer à leur traitement en écrivant à ${legalEntity.contact}. Vous pouvez aussi saisir la CNIL (cnil.fr).`,
        ],
      },
    ],
  },
  legal: {
    title: "Mentions légales",
    sections: [
      {
        title: "Éditeur",
        body: [
          legalEntity.company,
          legalEntity.registration,
          legalEntity.address,
          legalEntity.publisher,
          `Contact : ${legalEntity.contact}`,
        ],
      },
      {
        title: "Hébergement",
        body: [
          legalEntity.host,
          "Base de données : Neon Inc., région Union européenne (Francfort).",
        ],
      },
      {
        title: "Propriété",
        body: [
          "Les contenus publiés via Campaign restent la propriété des marques qui les produisent. L'application Campaign est éditée par ChoYou.",
        ],
      },
    ],
  },
} as const;
