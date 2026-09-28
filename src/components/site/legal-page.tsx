import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import type { LegalDocument } from "@/content/legal";
import { formatDate } from "@/lib/time";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://citylineairporttransfers.com";

/**
 * Shared layout for the terms and the privacy policy (WEB-03).
 *
 * Long legal text is read in two ways: start to finish, once, by someone
 * careful; and jumped into, by someone looking for one clause. The contents
 * list and the numbered, linkable headings serve the second reader, who is
 * much the more common of the two — and a deep link to a specific clause is
 * something support staff need when answering "where does it say that?".
 *
 * `max-w-2xl` on the body is deliberate: around 70 characters a line is what
 * long prose needs to stay readable, whatever the window is doing.
 */
export function LegalPage({
  document,
  draftNotice = true,
}: {
  document: LegalDocument;
  /**
   * These are drafts until a solicitor has reviewed them (§4, S7). The notice
   * is shown until Cityline confirms the review has happened — an unreviewed
   * policy presented as final is worse than one that says what it is.
   */
  draftNotice?: boolean;
}) {
  const slug = (heading: string) =>
    heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  return (
    <Container className="py-10">
      <Breadcrumbs crumbs={[{ label: document.title }]} siteUrl={siteUrl} />

      <div className="mt-space-lg max-w-2xl">
        <h1 className="text-headline-lg-mobile sm:text-headline-lg mb-2">
          {document.title}
        </h1>
        <p className="text-body-sm text-on-surface-variant">
          Last updated{" "}
          <time dateTime={document.updated}>
            {formatDate(new Date(`${document.updated}T00:00:00Z`))}
          </time>
        </p>

        {draftNotice ? (
          <p className="border-outline-variant bg-surface-container-low rounded-card p-space-md text-body-sm mt-space-lg flex gap-2.5 border">
            <AlertTriangle aria-hidden className="text-primary mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <strong className="text-on-surface">Draft.</strong> This document is
              awaiting review by a solicitor and is published so it can be read and
              commented on. It is not yet the final version.
            </span>
          </p>
        ) : null}

        <div className="gap-space-md text-body-md text-on-surface-variant mt-space-lg flex flex-col">
          {document.intro.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        <nav aria-labelledby="contents" className="mt-space-xl">
          <h2 id="contents" className="text-title-md mb-space-sm">
            Contents
          </h2>
          <ol className="text-body-sm grid gap-1.5 sm:grid-cols-2">
            {document.sections.map((section, index) => (
              <li key={section.heading} className="flex gap-2">
                <span className="text-on-surface-variant tabular-nums">{index + 1}.</span>
                <Link
                  href={`#${slug(section.heading)}`}
                  className="text-primary hover:underline"
                >
                  {section.heading}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className="gap-space-xl mt-space-xl flex flex-col">
          {document.sections.map((section, index) => (
            <section
              key={section.heading}
              id={slug(section.heading)}
              /* Clears the fixed header when jumped to from the contents. */
              className="scroll-mt-28"
            >
              <h2 className="text-headline-sm mb-space-sm">
                <span className="text-on-surface-variant mr-2 tabular-nums">
                  {index + 1}.
                </span>
                {section.heading}
              </h2>

              <div className="gap-space-sm text-body-md text-on-surface-variant flex flex-col">
                {section.body.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}

                {section.list ? (
                  <ul className="mt-space-xs gap-space-xs flex list-disc flex-col pl-5">
                    {section.list.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Container>
  );
}
