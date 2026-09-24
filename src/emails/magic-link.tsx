import { Button, Heading, Link, Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./layout";

export default function MagicLinkEmail({
  url = "https://campaign.choyou-tools.fr/api/auth/callback/resend?token=…",
  appUrl = "https://campaign.choyou-tools.fr",
}: {
  url?: string;
  appUrl?: string;
}) {
  return (
    <EmailLayout preview="Votre lien de connexion à Campaign" appUrl={appUrl}>
      <Heading style={emailStyles.heading}>Votre lien de connexion</Heading>
      <Text style={emailStyles.text}>
        Cliquez sur le bouton ci-dessous pour vous connecter à Campaign. Ce lien est valable 24
        heures et ne peut servir qu&apos;une fois.
      </Text>
      <Button href={url} style={emailStyles.button("#1F3A5F", "#ffffff")}>
        Me connecter
      </Button>
      <Text style={emailStyles.muted}>
        Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :<br />
        <Link href={url} style={{ color: "#1F3A5F", wordBreak: "break-all" }}>
          {url}
        </Link>
      </Text>
      <Text style={emailStyles.muted}>
        Vous n&apos;avez pas demandé ce lien ? Ignorez simplement cet e-mail : personne ne pourra se
        connecter sans lui.
      </Text>
    </EmailLayout>
  );
}
