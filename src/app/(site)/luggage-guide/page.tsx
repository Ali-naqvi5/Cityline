import type { Metadata } from "next";

import { HELP_LINKS, InfoPage, InfoSection } from "@/components/site/info-page";
import { HELP_FAQS } from "@/content/help-faqs";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

/**
 * How much each vehicle carries (WEB-03, §5 `/luggage-guide`).
 *
 * The table is `VEHICLE_CLASSES` itself — the same numbers step 2 of the funnel
 * uses to decide which vehicles fit a party. If this page said an estate takes
 * four cases while the funnel filtered it out at four, a customer would be told
 * one thing and sold another.
 */
export const metadata: Metadata = {
  title: "Luggage guide: what fits in each vehicle",
  description:
    "How many passengers, large cases and hand bags fit in each Cityline vehicle, from a saloon to a 16 seat minibus, and what to do about bulky items.",
  alternates: { canonical: "/luggage-guide" },
};

export default function LuggageGuidePage() {
  const classes = [...VEHICLE_CLASSES].sort((a, b) => a.sort - b.sort);

  /*
   * The worked example is derived rather than written, so it stays true when
   * the capacities change: the saloon, and the smallest vehicle that seats as
   * many people but also takes one large case per seat.
   */
  const saloon = classes.find((vehicle) => vehicle.slug === "saloon");
  const roomier = saloon
    ? classes.find(
        (vehicle) =>
          vehicle.maxPassengers >= saloon.maxPassengers &&
          vehicle.maxLargeBags >= saloon.maxPassengers,
      )
    : undefined;

  return (
    <InfoPage
      title="Luggage guide"
      lede="Book the vehicle that fits what you are carrying. Here is what each one takes, so you do not arrive to find the cases will not go in."
      faqs={HELP_FAQS.luggage}
      related={[
        HELP_LINKS.fleet,
        HELP_LINKS.fares,
        HELP_LINKS.childSeats,
        HELP_LINKS.meetingPoints,
        HELP_LINKS.terms,
        HELP_LINKS.faq,
      ]}
    >
      <section aria-labelledby="capacity-heading">
        <h2 id="capacity-heading" className="text-headline-sm mb-space-md">
          What each vehicle carries
        </h2>

        <div className="border-outline-variant rounded-card overflow-x-auto border">
          <table className="text-body-md w-full min-w-136 border-collapse text-left">
            <caption className="sr-only">
              Maximum passengers, large cases and hand luggage by vehicle
            </caption>
            <thead className="bg-surface-container-low text-body-sm text-on-surface-variant">
              <tr>
                <th scope="col" className="px-space-md py-space-sm font-medium">
                  Vehicle
                </th>
                <th
                  scope="col"
                  className="px-space-md py-space-sm text-right font-medium"
                >
                  Passengers
                </th>
                <th
                  scope="col"
                  className="px-space-md py-space-sm text-right font-medium"
                >
                  Large cases
                </th>
                <th
                  scope="col"
                  className="px-space-md py-space-sm text-right font-medium"
                >
                  Hand luggage
                </th>
              </tr>
            </thead>
            <tbody className="divide-outline-variant divide-y">
              {classes.map((vehicle) => (
                <tr key={vehicle.slug}>
                  <th scope="row" className="px-space-md py-space-sm font-normal">
                    <span className="text-on-surface block font-medium">
                      {vehicle.name}
                    </span>
                    <span className="text-body-sm text-on-surface-variant">
                      {vehicle.exampleModels}
                    </span>
                  </th>
                  <td className="px-space-md py-space-sm text-right tabular-nums">
                    {vehicle.maxPassengers}
                  </td>
                  <td className="px-space-md py-space-sm text-right tabular-nums">
                    {vehicle.maxLargeBags}
                  </td>
                  <td className="px-space-md py-space-sm text-right tabular-nums">
                    {vehicle.maxHandLuggage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-body-sm text-on-surface-variant mt-space-sm">
          These are maximums with every seat taken. With fewer passengers there is often
          room for more, but we can only promise the numbers shown.
        </p>
      </section>

      <InfoSection heading="Choosing the right vehicle">
        <p>
          When you book, tell us how many people are travelling and how many large cases
          you have. The booking form then only lets you choose a vehicle that takes both,
          so you cannot pick one that is too small by accident.
        </p>
        {saloon && roomier ? (
          <p>
            The most common mistake is counting seats and forgetting cases. A{" "}
            {saloon.name.toLowerCase()} seats {saloon.maxPassengers} but takes{" "}
            {saloon.maxLargeBags} large cases, so {saloon.maxPassengers} people each with
            a suitcase need something bigger. The smallest vehicle that fits them is the{" "}
            {roomier.name}, which seats {roomier.maxPassengers} and takes{" "}
            {roomier.maxLargeBags} large cases.
          </p>
        ) : null}
      </InfoSection>

      <InfoSection heading="Bulky and unusual items">
        <p>
          Skis, snowboards, golf clubs, bicycles in a bag, musical instruments, pushchairs
          and mobility aids can usually be carried, but they take the space of more than
          one case. Tell us about them in the notes when you book and we will make sure
          the vehicle we send will take them.
        </p>
        <p>
          A driver may decline to load anything that would not fit safely — a case on a
          passenger&rsquo;s lap or a blocked rear window is not something we can allow.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
