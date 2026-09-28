import type { PlaceFaq } from "@/domain/places/types";

/**
 * FAQs, with the `FAQPage` structured data SEO-04 asks for.
 *
 * Both come from the same array, so what Google reads and what a visitor reads
 * cannot drift apart — Google treats FAQ markup that does not match the visible
 * page as a spam signal, and it is an easy mistake to make when the two are
 * maintained separately.
 *
 * Built on `<details>` rather than JavaScript: it opens and closes with no
 * client bundle at all, it is keyboard operable for free, and — the part that
 * matters here — the answers are in the HTML whether or not they are expanded,
 * so a crawler sees them.
 */
export function FaqList({
  faqs,
  heading,
  headingId = "faqs",
}: {
  faqs: readonly PlaceFaq[];
  heading: string;
  headingId?: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-headline-md mb-space-lg">
        {heading}
      </h2>

      <div className="gap-space-sm flex flex-col">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="border-outline-variant rounded-card group open:bg-surface-container-low/40 border"
          >
            <summary className="p-space-lg text-title-md flex cursor-pointer items-center justify-between gap-4 marker:content-none [&::-webkit-details-marker]:hidden">
              {faq.question}
              <span
                aria-hidden
                className="border-outline-variant text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-lg leading-none transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="px-space-lg pb-space-lg text-body-md text-on-surface-variant">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>

      <script
        type="application/ld+json"
        // Generated from `faqs` above, never from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
