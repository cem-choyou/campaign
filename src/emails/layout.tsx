import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

// Shared e-mail frame: readable on mobile, brand accent on the header bar, legal footer.
export function EmailLayout({
  preview,
  accent = "#1F3A5F",
  brandName = "Campaign",
  appUrl,
  children,
}: {
  preview: string;
  accent?: string;
  brandName?: string;
  appUrl: string;
  children: ReactNode;
}) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={{ ...bar, backgroundColor: accent }} />
          <Section style={content}>
            <Text style={brand}>{brandName}</Text>
            {children}
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            Campaign · ChoYou —{" "}
            <Link href={`${appUrl}/confidentialite`} style={footerLink}>
              Confidentialité
            </Link>{" "}
            ·{" "}
            <Link href={`${appUrl}/mentions-legales`} style={footerLink}>
              Mentions légales
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = {
  heading: {
    fontSize: "20px",
    lineHeight: "28px",
    fontWeight: 600,
    color: "#18181b",
    margin: "8px 0 12px",
  },
  text: { fontSize: "15px", lineHeight: "24px", color: "#3f3f46", margin: "0 0 16px" },
  muted: { fontSize: "13px", lineHeight: "20px", color: "#71717a", margin: "16px 0 0" },
  button: (accent: string, foreground: string) => ({
    display: "inline-block",
    backgroundColor: accent,
    color: foreground,
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
    borderRadius: "8px",
    padding: "12px 20px",
  }),
};

const body = {
  backgroundColor: "#f4f4f5",
  fontFamily: "Inter, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "24px 12px",
};
const container = {
  maxWidth: "520px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  overflow: "hidden" as const,
};
const bar = { height: "6px" };
const content = { padding: "28px 28px 8px" };
const brand = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#71717a",
  margin: 0,
  letterSpacing: "0.02em",
};
const hr = { borderColor: "#e4e4e7", margin: "8px 28px" };
const footer = { fontSize: "12px", color: "#a1a1aa", padding: "0 28px 20px", margin: 0 };
const footerLink = { color: "#71717a", textDecoration: "underline" };
