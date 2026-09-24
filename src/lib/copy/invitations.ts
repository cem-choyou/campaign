export const invitationCopy = {
  pageTitle: "Invitation",
  title: (brand: string) => `Rejoindre ${brand}`,
  body: (role: string) =>
    `Vous êtes invité à accéder aux campagnes de la marque sur Campaign, en tant que ${role.toLowerCase()}.`,
  forEmail: (email: string) => `Invitation pour ${email}`,
  continueGoogle: "Continuer avec Google",
  continueEmail: "Recevoir mon lien de connexion",
  invalidTitle: "Cette invitation n'est plus valable",
  invalidBody:
    "Le lien a expiré ou a été remplacé par une invitation plus récente. Demandez à la personne qui vous a invité de vous l'envoyer à nouveau.",
  wrongAccountTitle: "Ce n'est pas le bon compte",
  wrongAccountBody: (invited: string, current: string) =>
    `Cette invitation est destinée à ${invited}, mais vous êtes connecté avec ${current}.`,
  switchAccount: "Me déconnecter et changer de compte",
  toSignIn: "Aller à la page de connexion",
} as const;
