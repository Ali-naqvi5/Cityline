import { company, formattedAddress } from "@/lib/company";
import { policies } from "@/lib/policies";

/**
 * Terms and conditions, and the privacy notice (WEB-03, CMP-11).
 *
 * ⚠️ **DRAFTS. Not legal advice, and not yet reviewed by a solicitor.**
 *
 * The project spec is explicit on both points: §4 says "have your T&Cs and
 * privacy policy checked by a UK solicitor", and S7 lists solicitor-reviewed
 * documents as an input Cityline must supply before launch. These pages exist
 * so the site is complete, the consent checkbox at checkout has something real
 * to link to, and a solicitor has a draft to mark up rather than a blank page.
 *
 * Written from scratch for Cityline. A competitor's terms were read for topic
 * coverage only — what a UK private hire operator's terms need to address —
 * and none of their wording is reproduced. Copying another company's terms is
 * both a copyright problem and a practical one: their policies are not ours.
 *
 * Every number here is read from `policies` and `company` rather than typed
 * in, so the terms cannot promise 60 minutes of waiting while the booking
 * pages say 45.
 *
 * The privacy notice follows the ICO's Article 13 checklist: who we are, what
 * we collect, why, the lawful basis, who it is shared with, how long it is
 * kept, your rights, and how to complain to the ICO.
 */
export interface LegalSection {
  heading: string;
  body: string[];
  list?: string[];
}

export interface LegalDocument {
  title: string;
  description: string;
  /** ISO date this draft was written. */
  updated: string;
  intro: string[];
  sections: LegalSection[];
}

const operator = company.showOperatorLicence
  ? `${company.legalName}, licensed by ${company.licensingAuthority} as a private hire operator under licence number ${company.operatorLicenceNumber}`
  : `${company.legalName}, licensed by ${company.licensingAuthority} as a private hire operator`;

export const TERMS: LegalDocument = {
  title: "Terms and conditions",
  description:
    "The terms on which Cityline Airport Transfers provides private hire journeys booked through this website.",
  updated: "2026-09-21",
  intro: [
    `These terms apply to every journey booked through this website with ${operator}. Please read them before you book — by completing a booking you are agreeing to them.`,
    `Our registered and operating address is ${formattedAddress()}. It is an office rather than a public counter: our licence carries a no public access condition, so please contact us by phone or email rather than calling in.`,
  ],
  sections: [
    {
      heading: "Who you are contracting with",
      body: [
        `Your contract is with ${company.legalName}. We are the licensed operator for your journey, not an agent introducing you to someone else, and we are responsible to you for the service you have booked.`,
        "Journeys are carried out by licensed private hire drivers in licensed private hire vehicles. We may use an approved sub-contractor where we need to, and where we do, we remain responsible to you under these terms.",
      ],
    },
    {
      heading: "Making a booking",
      body: [
        "You can book through this website, by telephone or by email. A booking is not confirmed until we have accepted it and you have received a confirmation containing your booking reference.",
        "Please check your confirmation carefully as soon as it arrives. The pickup address, date, time, flight number and destination on it are what your driver will be sent to. If anything is wrong, tell us straight away.",
      ],
    },
    {
      heading: "Giving us the right information",
      body: [
        "You are responsible for the accuracy of the details you give us, including the pickup address, the terminal you are landing at, the number of passengers and the amount of luggage.",
        "If the details are wrong and we cannot complete the journey as booked, we may have to charge for the journey. If your party or luggage turns out to be larger than booked and will not fit the vehicle you chose, we will do what we can, but we may not be able to carry you.",
      ],
    },
    {
      heading: "Prices and what they include",
      body: [
        "All prices are in pounds sterling and are fixed at the point you book. You see the price before you give us any personal details, and it does not change afterwards.",
        "Your fare includes the driver, the vehicle, fuel, the airport's own drop-off and parking charges, the Congestion Charge and ULEZ where your route passes through them, and any tolls on the route. It also includes meet and greet where you are being collected from an airport.",
      ],
      list: [
        "No card fees. Paying by card costs the same as any other method.",
        "No surge pricing. The fare does not rise at busy times, at night, or on public holidays.",
        "Extras you choose, such as child seats or additional waiting time, are shown separately and added to the total before you pay.",
      ],
    },
    {
      heading: "Payment",
      body: [
        "Payment is taken in full at the time of booking unless we have agreed otherwise in writing. Card payments are handled by our payment provider; we never see or store your full card number.",
        "Where we have agreed an account or a payment link with you, the terms of that arrangement apply in addition to these terms.",
      ],
    },
    {
      heading: "Waiting time",
      body: [
        `For airport pickups you have ${policies.airportFreeWaitingMinutes} minutes of free waiting time, counted from the time your flight lands rather than from the time you booked. For all other pickups you have ${policies.standardFreeWaitingMinutes} minutes from the booked time.`,
        "After the free period, waiting is charged at the rate shown when you book. If you know you will be delayed, please call us — we would rather hold the car than have you arrive to find it gone.",
      ],
    },
    {
      heading: "Flight delays and cancellations",
      body: [
        "Please give us your flight number when you book. Our team checks your flight's arrival time before sending your driver, so that a delayed flight does not leave you without a car or your driver waiting for hours.",
        "We do not operate automatic flight tracking, and we do not claim to. What we do is check your flight before dispatch and adjust the pickup accordingly. If your flight is diverted, badly delayed or cancelled, please contact us as soon as you know so that we can move or cancel the booking.",
      ],
    },
    {
      heading: "Changing your booking",
      body: [
        "You can change a booking through the link in your confirmation email or by contacting us. We will always try to accommodate a change.",
        "If a change increases the price — a longer journey, a larger vehicle, additional stops — we will tell you the new price before it takes effect and charge the difference. If it reduces the price, we will refund the difference to the card you paid with.",
      ],
    },
    {
      heading: "Cancellations and refunds",
      body: [
        `You may cancel free of charge up to ${policies.freeCancellationHours} hours before your booked pickup time and receive a ${policies.freeCancellationRefundPercent}% refund, returned to the card you paid with.`,
        `Cancellations inside ${policies.freeCancellationHours} hours may not be refunded, because at that point the vehicle and driver are committed to your journey. If your flight is cancelled by the airline, contact us and we will either move the booking or refund it.`,
        "Refunds are processed as soon as we have confirmed the cancellation. How quickly the money reaches you is down to your bank, and is usually a few working days.",
      ],
    },
    {
      heading: "If you do not arrive",
      body: [
        "If we cannot find you at the pickup point, your driver will wait for the free waiting period and we will try to contact you on the number you gave us. If we still cannot reach you, the booking may be treated as a no-show and charged in full.",
        "This is why the mobile number on your booking matters. Please give us one you will actually have with you and switched on.",
      ],
    },
    {
      heading: "Luggage",
      body: [
        "Each vehicle class carries a stated number of large cases and hand bags, shown on the fleet pages and when you choose a vehicle. Please book a class that fits what you are travelling with.",
        "Tell us in advance about anything bulky or unusual — skis, golf clubs, musical instruments, a pushchair — so we can send a vehicle that will take it. We cannot carry luggage that will not fit safely, and a driver may decline to load anything that would make the vehicle unsafe.",
      ],
    },
    {
      heading: "Children and child seats",
      body: [
        "Children are welcome. UK law requires appropriate child restraints for younger children, and you can request seats when you book. Any charge is shown in your quote before you pay.",
        "Please tell us the age and size of the child so that we send the right kind of seat. A seat requested on the day cannot be guaranteed.",
      ],
    },
    {
      heading: "Accessibility and assistance dogs",
      body: [
        "Tell us what you need when you book and we will do our best to arrange it. Assistance dogs travel with their owner at no extra charge.",
        "If you need a wheelchair accessible vehicle, please contact us before booking so we can confirm availability for your date and time.",
      ],
    },
    {
      heading: "Behaviour in the vehicle",
      body: [
        "Seatbelts must be worn where they are fitted. Smoking and vaping are not permitted in any vehicle, and nor is the consumption of alcohol or illegal substances.",
        "Drivers may end a journey where a passenger is behaving in a way that is unsafe, abusive or illegal. Where a vehicle is soiled or damaged, we may charge for cleaning or repair at cost.",
      ],
    },
    {
      heading: "Delays outside our control",
      body: [
        "We plan journeys with sensible allowances for traffic, but we cannot control the roads, the weather, road closures or the actions of third parties.",
        "Where a delay is genuinely outside our control we are not liable for onward costs such as missed flights, trains or appointments. Please allow enough time for your journey, and tell us if you are working to a hard deadline so we can advise on a pickup time.",
      ],
    },
    {
      heading: "Our liability to you",
      body: [
        "We provide our service with reasonable care and skill, and we are responsible for loss or damage we cause by failing to do so.",
        "We do not exclude or limit our liability where the law does not allow it, including liability for death or personal injury caused by our negligence, or for fraud. Nothing in these terms affects your statutory rights as a consumer.",
        "We recommend travel insurance for anything time-critical. Our vehicles carry the insurance that UK law requires for carrying passengers for hire and reward.",
      ],
    },
    {
      heading: "Lost property",
      body: [
        "If you leave something in a vehicle, contact us as soon as you can with your booking reference and a description. We will check with the driver and hold anything found securely.",
        "Where a return is arranged, we may charge for the cost of getting the item back to you.",
      ],
    },
    {
      heading: "Complaints",
      body: [
        `If something goes wrong, please tell us. Email ${company.email} or call us, quoting your booking reference, and we will look into it.`,
        "We aim to acknowledge complaints within two working days and resolve them within ten. Telling us promptly helps — details are easier to establish while the journey is recent.",
      ],
    },
    {
      heading: "Your personal information",
      body: [
        "We handle your personal information in line with our privacy policy, which explains what we collect, why, who it is shared with and how long we keep it.",
      ],
    },
    {
      heading: "Changes to these terms",
      body: [
        "We may update these terms from time to time. The terms that apply to your journey are the ones in force on the day you booked, and a copy is available on request.",
      ],
    },
    {
      heading: "Governing law",
      body: [
        "These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction over any dispute. If you live in Scotland or Northern Ireland, you may bring proceedings in your own country's courts.",
      ],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: "Privacy policy",
  description:
    "How Cityline Airport Transfers collects, uses and protects your personal information, and the rights you have over it.",
  updated: "2026-09-21",
  intro: [
    `${company.legalName} is the data controller for the personal information described here. Our address is ${formattedAddress()} and you can reach us at ${company.email}.`,
    "This notice explains what we collect when you book a journey, why we need it, who we share it with, how long we keep it and what rights you have. It is written to the Information Commissioner's Office guidance on what a privacy notice must contain.",
  ],
  sections: [
    {
      heading: "What we collect",
      body: ["When you book or contact us we collect:"],
      list: [
        "Your name, email address and mobile number.",
        "The name and number of the passenger travelling, where that is someone other than you.",
        "Pickup and destination addresses, dates, times and any stops on the way.",
        "Your flight number and airline, where you give them to us.",
        "Number of passengers, luggage, and any extras such as child seats.",
        "Anything you tell us in the notes field or in a message to us.",
        "Payment confirmation from our payment provider. We never receive or store your full card number.",
        "Basic technical information such as your IP address and browser, used to keep the site working and secure.",
      ],
    },
    {
      heading: "Why we use it, and our lawful basis",
      body: [
        "We use your information to carry out the journey you booked, and to run the business behind it. Our lawful bases are:",
      ],
      list: [
        "Performance of a contract — arranging and carrying out your journey, taking payment, handling changes, cancellations and refunds, and contacting you about your booking.",
        "Legal obligation — keeping the booking records that Transport for London requires of a licensed private hire operator, and keeping accounting records required by law.",
        "Legitimate interests — keeping our service safe and secure, preventing fraud, handling complaints and lost property, and improving how we work. We balance these against your rights.",
        "Consent — where you have asked to receive marketing from us, and for any non-essential cookies. You can withdraw consent at any time.",
      ],
    },
    {
      heading: "Who we share it with",
      body: [
        "We share only what is necessary, and only with organisations that need it to deliver your journey:",
      ],
      list: [
        "Your driver, and the vehicle operator where a journey is sub-contracted — they receive your name, contact number, pickup and destination, and any details needed to complete the journey safely.",
        "Stripe, our payment provider, which processes card payments and holds its own record of the transaction.",
        "Our email and SMS providers, which send your confirmation, receipt and driver details.",
        "Meta Platforms, which operates the WhatsApp Business Platform we use to send drivers their job details.",
        "Google, which provides mapping and address look-up used to price and plan journeys.",
        "Transport for London and other authorities, where we are required by law to produce booking records.",
        "Our accountants and professional advisers, where necessary.",
      ],
    },
    {
      heading: "Transfers outside the UK",
      body: [
        "Some of the providers above operate outside the United Kingdom. Where personal information is transferred outside the UK, we rely on the safeguards UK data protection law allows — an adequacy decision covering the destination country, or standard contractual clauses with the provider.",
        "You can ask us for details of the safeguards applying to a particular transfer.",
      ],
    },
    {
      heading: "How long we keep it",
      body: ["We do not keep personal information longer than we need to."],
      list: [
        "Booking records are kept for at least 12 months, because Transport for London requires a licensed operator to keep them.",
        "Records needed for accounting and tax are kept for six years.",
        "Complaints and lost property records are kept for 12 months.",
        "Marketing consent is kept until you withdraw it.",
      ],
    },
    {
      heading: "Your rights",
      body: ["Under UK data protection law you have the right to ask us to:"],
      list: [
        "Give you a copy of the personal information we hold about you.",
        "Correct anything that is wrong or incomplete.",
        "Delete information we no longer have a reason to keep.",
        "Restrict how we use your information, or object to us using it.",
        "Provide your information in a portable form, where it was given to us electronically.",
        "Stop sending you marketing, which you can do at any time.",
      ],
    },
    {
      heading: "Withdrawing consent",
      body: [
        "Where we rely on your consent — marketing, and non-essential cookies — you can withdraw it at any time. Withdrawing consent does not affect anything we did before you withdrew it, and it does not affect information we keep for a legal reason such as the booking register.",
      ],
    },
    {
      heading: "Cookies",
      body: [
        "We use cookies that are necessary for the site to function, such as keeping your place in the booking process. These do not need your consent.",
        "Any analytics or marketing cookies load only after you have agreed to them, and you can change your mind at any time.",
      ],
    },
    {
      heading: "Automated decision-making",
      body: [
        "We do not make decisions about you by automated means that have a legal or similarly significant effect. Your fare is calculated automatically from the journey, but drivers are allocated by our staff, not by a machine.",
      ],
    },
    {
      heading: "Keeping your information secure",
      body: [
        "Access to personal information is limited to staff who need it. Our website uses encrypted connections, our systems sit behind access controls, and sensitive records such as driver documents are held in private storage reachable only after a permission check.",
      ],
    },
    {
      heading: "How to contact us, and how to complain",
      body: [
        `To exercise any of your rights, or to ask a question about this notice, email ${company.email} or write to us at ${formattedAddress()}.`,
        "If you are unhappy with how we have handled your personal information, you can complain to the Information Commissioner's Office at ico.org.uk, by calling 0303 123 1113, or by writing to Information Commissioner's Office, Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF. We would appreciate the chance to put things right first.",
      ],
    },
    {
      heading: "Changes to this notice",
      body: [
        "We may update this notice as the service changes. The date at the top shows when it was last revised.",
      ],
    },
  ],
};
