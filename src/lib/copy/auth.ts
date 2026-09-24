export const authCopy = {
  pageTitle: "Connexion",
  title: "Connexion à Campaign",
  subtitle: "Planifiez, rédigez et suivez vos campagnes LinkedIn et YouTube.",
  google: "Continuer avec Google",
  googleHint: "Équipe ChoYou : utilisez votre compte @choyou.fr.",
  or: "ou",
  emailLabel: "Adresse e-mail",
  emailPlaceholder: "prenom.nom@entreprise.fr",
  emailSubmit: "Recevoir un lien de connexion",
  emailHint: "Clients et partenaires invités : recevez un lien de connexion par e-mail.",
  emailInvalid: "Saisissez une adresse e-mail valide, par exemple prenom.nom@entreprise.fr.",
  emailUnavailable:
    "La connexion par e-mail n'est pas encore disponible. L'équipe ChoYou peut se connecter avec Google.",
  sending: "Envoi en cours…",
  sentTitle: "Vérifiez votre boîte mail",
  sentBody:
    "Si cette adresse a accès à Campaign, un lien de connexion vous attend. Il est valable 24 h et ne sert qu'une fois.",
  sentHint: "Rien reçu après quelques minutes ? Vérifiez vos courriers indésirables.",
  sentBack: "Utiliser une autre adresse",
  rateLimited: (minutes: number) =>
    `Trop de demandes. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
  errors: {
    Domaine:
      "Ce compte Google n'appartient pas à l'équipe ChoYou. Utilisez votre adresse @choyou.fr, ou recevez un lien par e-mail si vous avez été invité.",
    Desactive:
      "Votre accès à Campaign a été désactivé. Contactez l'équipe ChoYou si c'est une erreur.",
    Verification:
      "Ce lien de connexion n'est plus valable (déjà utilisé ou expiré). Demandez-en un nouveau ci-dessous.",
    OAuthAccountNotLinked:
      "Cette adresse est déjà associée à une autre méthode de connexion. Utilisez le lien par e-mail.",
    AccessDenied: "Vous n'avez pas accès à Campaign avec ce compte.",
    Configuration: "La connexion est momentanément indisponible. Réessayez dans quelques minutes.",
    default: "La connexion n'a pas abouti. Réessayez, ou contactez l'équipe ChoYou.",
  } as Record<string, string>,
} as const;
