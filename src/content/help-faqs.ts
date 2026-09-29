import { noticePhrase } from "@/domain/booking/booking-window";
import { formatPence } from "@/domain/money";
import type { PlaceFaq } from "@/domain/places/types";
import { EXTRAS } from "@/domain/pricing/extras";
import { company } from "@/lib/company";
import { policies } from "@/lib/policies";

/**
 * The bookable extra waiting time, so its price is read from the catalogue.
 * Missing it fails the build rather than printing a wrong price.
 */
const EXTRA_WAITING = EXTRAS.find((extra) => extra.slug === "extra-waiting");
if (!EXTRA_WAITING) throw new Error("The extra-waiting extra is missing from EXTRAS.");

/**
 * The help pages' FAQs, in one place (WEB-03).
 *
 * Each help page shows its own group, and `/faq` shows them all. Keeping them
 * here rather than in the page files means an answer is written once: if the
 * cancellation page and the FAQ page each had their own copy of "how long does
 * a refund take?", one of them would eventually be wrong.
 *
 * Every figure is read from `policies` or `company`, never typed in.
 */
export const HELP_FAQS = {
  /** General questions, shown only on `/faq`. */
  booking: [
    {
      question: "Do I need an account to book?",
      answer:
        "No. You book as a guest, and your confirmation email contains a link to view, change or cancel the booking — no password to remember.",
    },
    {
      question: "How far ahead do I need to book?",
      answer: `Online bookings need at least ${noticePhrase()} before pickup. For anything sooner, call us on ${company.phone} and we will see what we can do.`,
    },
    {
      question: "Is the fare per person or for the whole vehicle?",
      answer:
        "For the whole vehicle. Everyone travelling together shares one fare, however many seats are taken.",
    },
    {
      question: "Can I book a return journey?",
      answer:
        "Yes. Add the return when you book and both journeys go on one booking, with one payment and one confirmation.",
    },
    {
      question: "Are you licensed?",
      answer: `Yes. ${company.legalName} is a private hire operator licensed by ${company.licensingAuthority}. Every driver and vehicle is licensed for private hire, and before your journey we send you your driver's licence number and the vehicle's registration.`,
    },
  ],

  meetingPoints: [
    {
      question: "What name will be on the driver's board?",
      answer:
        "The name of the passenger travelling, as you gave it when you booked. If you booked for someone else, it is their name, not yours — so they are the one who needs to look for it.",
    },
    {
      question: "What if my flight lands late?",
      answer: `Our team checks your flight's arrival time before sending your driver, so a delay does not cost you anything. Your ${policies.airportFreeWaitingMinutes} minutes of free waiting are counted from when the flight actually lands, not from the time you booked.`,
    },
    {
      question: "Will my driver come inside, or wait outside?",
      answer:
        "Inside. Meet and greet in the arrivals hall is included on every airport pickup, so you do not have to find the car park or a pickup zone with your luggage.",
    },
    {
      question: "How will I know which driver is mine?",
      answer:
        "Before your pickup we send you your driver's first name, their licence number, and the make, colour and registration of the car. Check the registration before you get in.",
    },
    {
      question: "I cannot see my driver. What should I do?",
      answer: `Stay where you are and call us on ${company.phone}. Walking around to look usually makes it harder: we will put you in touch with your driver and tell them exactly where you are standing.`,
    },
  ],

  luggage: [
    {
      question: "What counts as a large case?",
      answer:
        "A checked-in suitcase — roughly anything that would go in an aircraft hold. A cabin bag, a laptop bag or a handbag counts as hand luggage.",
    },
    {
      question: "What if we have more luggage than the vehicle allows?",
      answer:
        "Choose a larger vehicle when you book. The booking form only lets you choose vehicles that fit the passengers and cases you tell us about, and says why the others are too small — so give us the real numbers and the choice is made for you.",
    },
    {
      question: "Can you take skis, golf clubs or a pushchair?",
      answer:
        "Usually, yes, but tell us when you book so we can send a vehicle that will take them. An estate or an MPV is normally the right choice for anything long or bulky.",
    },
    {
      question: "Do I pay extra for luggage?",
      answer:
        "No. The fare covers the vehicle, and the luggage limits below are what that vehicle carries safely. You pay for a larger vehicle, not for extra bags.",
    },
  ],

  childSeats: [
    {
      question: "Who fits the seat?",
      answer:
        "Your driver fits it before collecting you, so it is ready when you get in. Please check the harness is adjusted for your child before setting off — you know their size better than anyone.",
    },
    {
      question: "Can I bring my own seat?",
      answer:
        "Yes. Tell us in the notes when you book, so the driver knows to allow the time and the space to fit it.",
    },
    {
      question: "Can I add a seat after booking?",
      answer:
        "Yes, through the link in your confirmation email or by calling us. The sooner the better: a seat asked for on the day cannot be guaranteed.",
    },
    {
      question: "How many seats can one car take?",
      answer:
        "It depends on the vehicle, and every child needs their own seat. The booking form warns you if you add more seats than there are passengers travelling.",
    },
  ],

  cancellation: [
    {
      question: "My flight has been cancelled. What happens to my booking?",
      answer:
        "Contact us as soon as you know. If the airline has cancelled your flight, we will either move your booking to your new flight or refund it.",
    },
    {
      question: "Can I change my booking instead of cancelling?",
      answer:
        "Yes, and it is usually the better option. If the change costs more — a larger vehicle, a longer journey — we tell you the new price before it takes effect. If it costs less, we refund the difference.",
    },
    {
      question: "How long does a refund take?",
      answer:
        "We process it as soon as the cancellation is confirmed. How quickly it reaches your account is down to your bank, and is usually a few working days.",
    },
    {
      question: "What happens if I do not turn up?",
      answer:
        "If your driver cannot find you and we cannot reach you on the number you gave us, the booking may be treated as a no-show and charged in full. Keep your phone on and with you.",
    },
  ],

  payment: [
    {
      question: "Do I pay the driver?",
      answer:
        "No. Your fare is paid in full when you book, so there is nothing to settle on the day.",
    },
    {
      question: "Can the price change after I book?",
      answer:
        "No. The fare you see before you pay is the fare you pay. It only changes if you change the booking yourself, and we tell you the new price before it takes effect.",
    },
    {
      question: "Do you store my card details?",
      answer:
        "No. Card details are entered directly with our payment provider, Stripe, and never reach Cityline's systems. We only ever see that a payment succeeded.",
    },
    {
      question: "Can my company pay on account?",
      answer:
        "We can set up an account or send a payment link for business customers. Contact us to arrange it before you book.",
    },
  ],

  lostProperty: [
    {
      question: "How quickly should I report it?",
      answer:
        "As soon as you notice. Your driver may have another passenger within the hour, and an item is far easier to find before the next journey than after it.",
    },
    {
      question: "Will I have to pay to get it back?",
      answer:
        "There may be a charge to cover the cost of getting the item back to you. If there is, we tell you what it is before arranging anything.",
    },
    {
      question: "I lost something at the airport, not in the car.",
      answer:
        "Items left in a terminal are handled by the airport's own lost property office, not by us. Your airline can also help with anything left on board the aircraft.",
    },
  ],

  waiting: [
    {
      question: "When does my free waiting time start at the airport?",
      answer: `When your flight actually lands, not at the time you booked. Our team checks your flight's arrival time before sending your driver, so a delayed flight does not use up your ${policies.airportFreeWaitingMinutes} minutes.`,
    },
    {
      question: "What if I will need longer than the free waiting time?",
      answer: `Add extra waiting time when you book, in 30-minute blocks at ${formatPence(EXTRA_WAITING.pricePence)} each. If you find out on the day, call us — we would much rather hold the car than have you come out to find it gone.`,
    },
    {
      question: "How long will my driver wait at a station, hotel or my home?",
      answer: `${policies.standardFreeWaitingMinutes} minutes from the booked pickup time. Please be ready at the door; if you are running late, call us and let us know.`,
    },
    {
      question: "What happens if I do not turn up?",
      answer:
        "Your driver waits for the free waiting time and we try to reach you on the number you gave us. If we still cannot find you, the booking may be treated as a no-show and charged in full — so keep your phone on and with you.",
    },
  ],

  accessibility: [
    {
      question: "Do you charge extra for a wheelchair or mobility aid?",
      answer:
        "No. A folding wheelchair, walking frame or other mobility aid travels free, and so does any help your driver gives you. Tell us what you are bringing so we send a car it fits in.",
    },
    {
      question: "Can I travel with my assistance dog?",
      answer:
        "Yes, always, and at no extra charge. Assistance dogs travel with their owner in every vehicle we send.",
    },
    {
      question: "Do you have wheelchair accessible vehicles?",
      answer: `Our standard fleet does not include vehicles with a ramp or lift. If you need to travel seated in your wheelchair, call us on ${company.phone} before booking and we will tell you what we can arrange for your date and time.`,
    },
    {
      question: "Can my driver help me to and from the car?",
      answer:
        "Yes. Tell us in the notes when you book what would help — a hand with luggage, help to the door, or a little more time — and your driver will know before they arrive.",
    },
  ],
} as const satisfies Record<string, readonly PlaceFaq[]>;
