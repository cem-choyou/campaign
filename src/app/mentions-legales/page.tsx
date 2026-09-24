import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";
import { legalCopy } from "@/lib/copy/legal";

export const metadata: Metadata = { title: legalCopy.legal.title };

export default function LegalNoticePage() {
  return <LegalPage title={legalCopy.legal.title} sections={legalCopy.legal.sections} />;
}
