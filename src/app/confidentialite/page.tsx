import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";
import { legalCopy } from "@/lib/copy/legal";

export const metadata: Metadata = { title: legalCopy.privacy.title };

export default function PrivacyPage() {
  return (
    <LegalPage
      title={legalCopy.privacy.title}
      updated={legalCopy.privacy.updated}
      sections={legalCopy.privacy.sections}
    />
  );
}
