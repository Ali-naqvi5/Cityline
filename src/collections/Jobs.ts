import type { CollectionConfig } from "payload";

import { allow } from "@/access/staff";

import { auditChanges } from "./hooks/audit";
import { applyDispatchRules, recordJobHistory } from "./hooks/job-dispatch";
import { enforceJobRules } from "./hooks/jobs";

/**
 * The one job register, for every source (§2, §14 `jobs`).
 *
 * This is the table the whole operation runs on and the one TfL inspects. A
 * website booking creates one job per leg (BK-09); supplier and phone jobs are
 * entered by staff in S8. They all live here so nothing falls between two
 * systems.
 *
 * Fields carrying a hard rule rather than just data:
 *
 *   `source` is required and **immutable**. §2 is explicit that the staff form
 *   may not create website jobs — only checkout can — which is what stops one
 *   booking being recorded twice.
 *
 *   `driverPhvNo` and `vehicleReg` are **copied onto the job at assignment**,
 *   not looked up later (CMP-03). If a driver's licence is renewed next year,
 *   the register must still show the number that applied on the day.
 *
 *   `takenByUser` is null for website jobs — the system took the booking. The
 *   TfL record needs both who took it and who dispatched it.
 *
 *   `locked` marks the website fields the amend flow owns (JOB-07): price,
 *   customer and route come from the booking and are not edited here.
 *
 * Assigning a driver, the status order and the job's own history are enforced
 * by hooks (`hooks/job-dispatch.ts`) on every write, not only by the screens:
 * an expired driver cannot be given a job through the API either.
 */
export const Jobs: CollectionConfig = {
  slug: "jobs",
  admin: {
    useAsTitle: "reference",
    defaultColumns: ["reference", "source", "status", "pickupAt", "leadName"],
    description: "Every job, every source. The TfL booking register (CMP-03).",
  },
  access: {
    read: allow("jobs.view"),
    create: allow("jobs.edit"),
    update: allow("jobs.edit"),
    delete: () => false, // DATA-11: archived, never deleted
  },
  hooks: {
    beforeChange: [enforceJobRules, applyDispatchRules],
    afterChange: [
      auditChanges<{ id: number; reference: string }>({ label: (doc) => doc.reference }),
      recordJobHistory,
    ],
  },
  fields: [
    // --- Identity ---------------------------------------------------------
    {
      name: "reference",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: "J-000001" },
    },
    {
      name: "source",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Website", value: "website" },
        { label: "Supplier", value: "supplier" },
        { label: "Phone", value: "phone" },
        { label: "WhatsApp", value: "whatsapp" },
        { label: "Email", value: "email" },
        { label: "Account", value: "account" },
        { label: "Other", value: "other" },
      ],
      admin: {
        readOnly: true,
        description: "Required and immutable (§2). Website jobs come only from checkout.",
      },
    },
    {
      name: "supplier",
      type: "relationship",
      relationTo: "suppliers",
      index: true,
      admin: { description: "Required for supplier jobs (JOB-01)." },
    },
    {
      name: "supplierReference",
      type: "text",
      index: true,
      admin: {
        description:
          "The supplier's booking reference. Unique per supplier — the same job cannot be entered twice (JOB-03).",
      },
    },
    { name: "booking", type: "relationship", relationTo: "bookings", index: true },
    {
      name: "leg",
      type: "select",
      options: [
        { label: "Outbound", value: "outbound" },
        { label: "Return", value: "return" },
      ],
      admin: { description: "One job per leg. Unique per (booking, leg)." },
    },
    { name: "returnOfJob", type: "relationship", relationTo: "jobs" },

    // --- Journey ----------------------------------------------------------
    {
      type: "collapsible",
      label: "Journey",
      fields: [
        { name: "pickupAt", type: "date", required: true, index: true },
        { name: "pickupAddress", type: "text", required: true },
        { name: "pickupLat", type: "number" },
        { name: "pickupLng", type: "number" },
        { name: "dropoffAddress", type: "text" },
        { name: "dropoffLat", type: "number" },
        { name: "dropoffLng", type: "number" },
        {
          name: "viaStops",
          type: "array",
          fields: [
            { name: "address", type: "text", required: true },
            { name: "lat", type: "number" },
            { name: "lng", type: "number" },
          ],
        },
        {
          name: "flightNumber",
          type: "text",
          index: true,
          admin: {
            description:
              "So the office can check the arrival time before dispatch, and so a controller can search on it (JOB-11). No automatic flight tracking exists.",
          },
        },
        { name: "flightArrivalAt", type: "date" },
        { name: "distanceM", type: "number" },
        { name: "durationS", type: "number" },
        {
          name: "hours",
          type: "number",
          admin: { description: "Hourly hire only: how long the car is booked for." },
        },
      ],
    },

    // --- Passengers -------------------------------------------------------
    {
      type: "collapsible",
      label: "Passengers",
      fields: [
        { name: "vehicleClassSlug", type: "text", required: true },
        { name: "passengers", type: "number", required: true },
        { name: "largeBags", type: "number", required: true, defaultValue: 0 },
        { name: "smallBags", type: "number", required: true, defaultValue: 0 },
        { name: "leadName", type: "text", required: true, index: true },
        { name: "leadPhone", type: "text", required: true, index: true },
        { name: "leadEmail", type: "email" },
        {
          name: "bookerName",
          type: "text",
          admin: {
            description:
              "Who booked, when it is not the passenger — a PA, a travel agent. Staff jobs only; a website booking keeps its booker on the booking.",
          },
        },
        { name: "bookerPhone", type: "text" },
        { name: "bookerEmail", type: "email" },
        { name: "meetAndGreet", type: "checkbox", defaultValue: true },
        {
          name: "nameBoardText",
          type: "text",
          admin: {
            description:
              "What goes on the driver's board. The travelling passenger's name, not the booker's.",
          },
        },
        {
          name: "extras",
          type: "array",
          fields: [
            { name: "slug", type: "text", required: true },
            { name: "quantity", type: "number", required: true },
            { name: "unitPricePence", type: "number", required: true },
          ],
        },
      ],
    },

    // --- Dispatch (TfL record, CMP-03) -----------------------------------
    {
      type: "collapsible",
      label: "Dispatch",
      fields: [
        {
          name: "status",
          type: "select",
          required: true,
          defaultValue: "unassigned",
          index: true,
          options: [
            { label: "Unassigned", value: "unassigned" },
            { label: "Assigned", value: "assigned" },
            { label: "Driver confirmed", value: "driver_confirmed" },
            { label: "Completed", value: "completed" },
            { label: "No show", value: "no_show" },
            { label: "Cancelled", value: "cancelled" },
          ],
        },
        { name: "driver", type: "relationship", relationTo: "drivers", index: true },
        { name: "vehicle", type: "relationship", relationTo: "vehicles", index: true },
        {
          name: "driverPhvNo",
          type: "text",
          admin: {
            description:
              "Copied onto the job at assignment, not looked up later (CMP-03). The register must show the number that applied on the day.",
          },
        },
        { name: "vehicleReg", type: "text" },
        {
          name: "takenByUser",
          type: "relationship",
          relationTo: "users",
          admin: { description: "Null for website jobs — the system took the booking." },
        },
        { name: "takenAt", type: "date" },
        { name: "dispatchedByUser", type: "relationship", relationTo: "users" },
        { name: "dispatchedAt", type: "date" },
        { name: "subcontractorName", type: "text" },
        { name: "driverConfirmedAt", type: "date" },
        { name: "completedAt", type: "date" },
        { name: "noShowAt", type: "date" },
        { name: "cancelledAt", type: "date" },
        { name: "cancelReason", type: "textarea" },
      ],
    },

    // --- Messages (WA-03, NOT-02) --------------------------------------------
    {
      type: "collapsible",
      label: "Messages",
      fields: [
        {
          name: "driverMessageStatus",
          type: "select",
          required: true,
          defaultValue: "not_sent",
          options: [
            { label: "Not sent", value: "not_sent" },
            { label: "Sent", value: "sent" },
            { label: "Delivered", value: "delivered" },
            { label: "Read", value: "read" },
            { label: "Failed", value: "failed" },
          ],
          admin: {
            description:
              "The job message to the assigned driver. Reset when the driver changes.",
          },
        },
        { name: "driverMessageAt", type: "date" },
        {
          name: "passengerMessageStatus",
          type: "select",
          required: true,
          defaultValue: "not_sent",
          options: [
            { label: "Not sent", value: "not_sent" },
            { label: "Sent", value: "sent" },
            { label: "Failed", value: "failed" },
          ],
          admin: {
            description: "The driver's details emailed to the passenger (NOT-02).",
          },
        },
        { name: "passengerMessageAt", type: "date" },
      ],
    },

    // --- Finance ----------------------------------------------------------
    {
      type: "collapsible",
      label: "Finance",
      fields: [
        {
          name: "customerPricePence",
          type: "number",
          required: true,
          admin: {
            description:
              "CMP-02: a fare must be agreed before the journey and recorded. Integer pence (NFR-08).",
          },
        },
        {
          name: "paymentMethod",
          type: "select",
          required: true,
          defaultValue: "web_prepaid",
          options: [
            { label: "Paid on the website", value: "web_prepaid" },
            { label: "Supplier pays", value: "supplier" },
            { label: "Cash", value: "cash" },
            { label: "Card link", value: "card_link" },
            { label: "Bank transfer", value: "bank" },
            { label: "On account", value: "account" },
          ],
        },
        {
          name: "commissionBp",
          type: "number",
          min: 0,
          max: 10_000,
          admin: {
            description:
              "The supplier's commission rate when the job was entered. A later change to the supplier's default does not alter it (FIN-00).",
          },
        },
        {
          name: "commissionPence",
          type: "number",
          min: 0,
          admin: { description: "What the supplier keeps. Editable per job." },
        },
        {
          name: "paymentFeePence",
          type: "number",
          defaultValue: 0,
          admin: { description: "Stripe's fee, from the webhook." },
        },
        {
          name: "locked",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description:
              "JOB-07: website jobs lock price, customer and route. Changes go through the booking's amend flow.",
          },
        },
      ],
    },

    // --- Notes ------------------------------------------------------------
    { name: "driverNotes", type: "textarea" },
    { name: "internalNotes", type: "textarea" },
    {
      name: "notifyPassenger",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description:
          "Email the passenger their driver's details when a driver is assigned (NOT-02). Some suppliers contact their passengers themselves.",
      },
    },
    { name: "archivedAt", type: "date" },
    {
      name: "isTest",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "PRD-07: excluded from reports and TfL exports." },
    },
  ],
};
