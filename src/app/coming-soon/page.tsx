import type { Metadata } from "next";

/**
 * The page the public sees while the launch gate is on (PRD-02).
 * Deliberately plain: the real design arrives with the Figma file (§6).
 * Legal block per CMP-09; no "visit us" wording, because the operating centre
 * carries a No Public Access condition (CMP-08).
 */
export const metadata: Metadata = {
  title: "Cityline Airport Transfers — coming soon",
  description:
    "Licensed London airport transfers from Cityline Airport Transfers Limited. Our new booking site is on its way.",
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-4 py-16">
      <div className="space-y-4">
        <p className="text-sm font-semibold tracking-[0.18em] text-neutral-500 uppercase">
          Cityline Airport Transfers
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Our new booking site is on its way.
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-300">
          Licensed London airport transfers, chauffeur-driven and priced up front. Until
          the new site opens, please book by phone or email.
        </p>
      </div>

      <dl className="grid gap-4 border-y border-neutral-200 py-6 sm:grid-cols-2 dark:border-neutral-800">
        <div>
          <dt className="text-sm text-neutral-500">Telephone</dt>
          <dd className="font-semibold">
            {/* TODO(S4): public phone number supplied by Cityline (§16 inputs). */}
            Booking line — number to be confirmed
          </dd>
        </div>
        <div>
          <dt className="text-sm text-neutral-500">Email</dt>
          <dd className="font-semibold">bookings@citylineairporttransfers.com</dd>
        </div>
      </dl>

      <footer className="space-y-1 text-sm text-neutral-500">
        <p>
          Cityline Airport Transfers Limited · TfL private hire operator licence 11628
        </p>
        <p>
          Registered and operating address: Hillingdon House, Wren Avenue, Uxbridge UB10
          0FD. No public access.
        </p>
      </footer>
    </main>
  );
}
