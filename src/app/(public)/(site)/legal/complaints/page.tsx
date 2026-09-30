import type { Metadata } from "next";

import { LegalPage } from "@/components/site/legal-page";
import { COMPLAINTS } from "@/content/legal";

export const metadata: Metadata = {
  title: COMPLAINTS.title,
  description: COMPLAINTS.description,
  alternates: { canonical: "/legal/complaints" },
};

export default function ComplaintsPage() {
  return <LegalPage document={COMPLAINTS} />;
}
