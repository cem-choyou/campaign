import { Button, Heading, Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

export default function InvitationEmail({
  url = "https://campaign.choyou-tools.fr/invitation/…",
  appUrl = "https://campaign.choyou-tools.fr",
  brandName = "IT for Business",
  inviterName = "Cem",
  roleLabel = "Éditeur",
  accent = "#1F3A5F",
  accentForeground = "#FFFFFF",
}: {
  url?: string;
  appUrl?: string;
  brandName?: string;
  inviterName?: string;
  roleLabel?: string;
  accent?: string;
  accentForeground?: string;
}) {
  return (
    <EmailLayout
      preview={`${inviterName} vous invite à rejoindre ${brandName} sur Campaign`}
      appUrl={appUrl}
      accent={accent}
      brandName={brandName}
    >
      <Heading style={emailStyles.heading}>Vous êtes invité à rejoindre {brandName}</Heading>
      <Text style={emailStyles.text}>
        {inviterName} vous donne accès aux campagnes de {brandName} sur Campaign, en tant que{" "}
        <strong>{roleLabel.toLowerCase()}</strong>. Campaign sert à planifier, rédiger et valider
        les publications LinkedIn et YouTube de la marque.
      </Text>
      <Button href={url} style={emailStyles.button(accent, accentForeground)}>
        Accepter l&apos;invitation
      </Button>
      <Text style={emailStyles.muted}>
        Cette invitation est valable 7 jours. Le bouton ne fonctionne pas ? Copiez ce lien :
        <br />
        <Link href={url} style={{ color: accent, wordBreak: "break-all" }}>
          {url}
        </Link>
      </Text>
    </EmailLayout>
  );
}
