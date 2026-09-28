import type { Metadata } from "next";

import { LegalPage } from "@/components/site/legal-page";
import { LICENSING } from "@/content/legal";

export const metadata: Metadata = {
  title: LICENSING.title,
  description: LICENSING.description,
  alternates: { canonical: "/legal/licensing" },
};

export default function LicensingPage() {
  return <LegalPage document={LICENSING} draftNotice={false} />;
}
