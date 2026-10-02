/**
 * Which airport, and which terminal, an address is — "Heathrow T5",
 * "Gatwick North" — for reports that count work by airport. Read from the
 * address, which names the airport or its terminal for every airport pickup
 * the website and the office enter.
 */

export interface AirportPlace {
  airport: string;
  /** The airport with its terminal when known: "Heathrow T3". */
  label: string;
}

export function airportOf(address: string | null | undefined): AirportPlace | null {
  if (!address) return null;
  const text = address.toLowerCase();
  const terminal = text.match(/\bterminal\s*([1-5])\b/)?.[1];

  if (/\bgatwick\b|\blgw\b|\b(north|south) terminal\b/.test(text)) {
    const side = text.match(/\b(north|south) terminal\b|\bgatwick (north|south)\b/);
    const name = side?.[1] ?? side?.[2];
    return {
      airport: "Gatwick",
      label: name ? `Gatwick ${name[0]!.toUpperCase()}${name.slice(1)}` : "Gatwick",
    };
  }
  if (
    /\bheathrow\b|\blhr\b|\btw6\b/.test(text) ||
    (terminal && /\b(longford|hounslow)\b/.test(text))
  ) {
    return {
      airport: "Heathrow",
      label: terminal ? `Heathrow T${terminal}` : "Heathrow",
    };
  }
  if (/\bstansted\b|\bstn\b/.test(text))
    return { airport: "Stansted", label: "Stansted" };
  if (/\bluton airport\b|\bltn\b|\blondon luton\b/.test(text)) {
    return { airport: "Luton", label: "Luton" };
  }
  if (/\bcity airport\b|\blcy\b/.test(text))
    return { airport: "London City", label: "London City" };
  if (/\bsouthend airport\b|\bsen\b/.test(text))
    return { airport: "Southend", label: "Southend" };
  if (/\bairport\b/.test(text))
    return { airport: "Other airport", label: "Other airport" };
  return null;
}
