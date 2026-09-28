import type { Metadata } from "next";

import { LegalPage } from "@/components/site/legal-page";
import { COOKIES } from "@/content/legal";

export const metadata: Metadata = {
  title: COOKIES.title,
  description: COOKIES.description,
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return <LegalPage document={COOKIES} />;
}
