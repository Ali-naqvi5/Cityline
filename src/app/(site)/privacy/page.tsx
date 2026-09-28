import type { Metadata } from "next";

import { LegalPage } from "@/components/site/legal-page";
import { PRIVACY } from "@/content/legal";

export const metadata: Metadata = {
  title: PRIVACY.title,
  description: PRIVACY.description,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <LegalPage document={PRIVACY} />;
}
