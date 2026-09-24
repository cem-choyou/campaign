// Human-readable activity log (§8.6 « Activité »): « Cem a renommé la campagne en … ».

type Meta = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

export function activitySentence(type: string, meta: Meta, actor: string): string {
  switch (type) {
    case "campaign.created":
      return `${actor} a créé la campagne`;
    case "campaign.renamed":
      return `${actor} a renommé la campagne en « ${str(meta.to)} »`;
    case "campaign.duplicated":
      return num(meta.shiftDays)
        ? `${actor} a dupliqué « ${str(meta.from)} » en décalant les dates de ${num(meta.shiftDays)} jours`
        : `${actor} a dupliqué « ${str(meta.from)} »`;
    case "campaign.archived":
      return `${actor} a archivé la campagne`;
    case "campaign.unarchived":
      return `${actor} a désarchivé la campagne`;
    case "campaign.updated":
      return `${actor} a modifié les réglages de la campagne`;
    case "content.created":
      return `${actor} a ajouté le contenu ${str(meta.code)}`;
    case "content.deleted":
      return `${actor} a supprimé le contenu ${str(meta.code)}`;
    case "post.created":
      return `${actor} a planifié un post ${str(meta.label)}`.trim();
    case "post.moved":
      return `${actor} a déplacé un post au ${str(meta.to)}`;
    case "post.updated":
      return `${actor} a modifié un post`;
    case "post.deleted":
      return num(meta.count) > 1
        ? `${actor} a supprimé ${num(meta.count)} posts`
        : `${actor} a supprimé un post`;
    case "post.bulk_moved":
      return `${actor} a décalé ${num(meta.count)} posts`;
    case "post.status_changed":
      return `${actor} a changé le statut d'un post`;
    case "post.approved":
      return `${actor} a validé un post`;
    case "post.published":
      return `${actor} a publié un post`;
    default:
      return `${actor} a modifié la campagne`;
  }
}
