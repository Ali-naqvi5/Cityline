import type { Metadata } from "next";

import { LegalPage } from "@/components/site/legal-page";
import { TERMS } from "@/content/legal";

export const metadata: Metadata = {
  title: TERMS.title,
  description: TERMS.description,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <LegalPage document={TERMS} />;
}
