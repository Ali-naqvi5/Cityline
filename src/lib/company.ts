/**
 * Company details shown across the site, and the contact route CMP-07 requires.
 * One place to change, so a wrong number is a one-line fix.
 *
 * In S8 this moves to the Payload `site_settings` global so the office can edit
 * it without a deployment (ADM-01).
 */
export const company = {
  legalName: "Cityline Airport Transfers Limited",
  tradingName: "Cityline Airport Transfers",

  licensingAuthority: "Transport for London",
  operatorLicenceNumber: "11628",

  /**
   * Cityline's instruction (20 Sep 2026) is not to display the operator licence
   * number anywhere on the site, so it is held here but never rendered.
   *
   * Worth knowing before launch: CMP-09 in the project spec lists the operator
   * licence number among the details that must be shown, and TfL expects
   * operators to identify their licence in advertising. Flipping this to `true`
   * restores it in the header and footer — no other change needed.
   */
  showOperatorLicence: false,

  /**
   * Registered and operating address. Shown as an address only — the licence
   * carries a No Public Access condition, so no "visit us" wording and no map
   * pin on the contact page (CMP-08).
   */
  address: {
    line1: "Hillingdon House",
    line2: "Wren Avenue",
    town: "Uxbridge",
    postcode: "UB10 0FD",
    country: "United Kingdom",
  },

  /**
   * PLACEHOLDER. Deliberately from Ofcom's 020 7946 0xxx range, which is
   * reserved for drama and can never connect to a real person or business —
   * so if it survives to launch it cannot misdirect a customer.
   * TODO(Cityline): replace with the real booking line before go-live.
   */
  phone: "+44 20 7946 0812",
  phoneIsPlaceholder: true,

  whatsapp: null as string | null,
  email: "bookings@citylineairporttransfers.com",

  /** Confirmed by Cityline: the phones are staffed around the clock (CMP-07). */
  serviceHours: "24/7 dispatch",

  // TODO(Cityline): supplied with the phase-1 page copy (§16).
  companyNumber: null as string | null,
  /** null = not VAT registered, which changes how prices are displayed (§17). */
  vatNumber: null as string | null,
} as const;

export function formattedAddress(): string {
  const { line1, line2, town, postcode } = company.address;
  return [line1, line2, town, postcode].filter(Boolean).join(", ");
}

/** Digits only, for `tel:` links. */
export function telHref(): string {
  return `tel:${company.phone.replace(/[^+\d]/g, "")}`;
}
