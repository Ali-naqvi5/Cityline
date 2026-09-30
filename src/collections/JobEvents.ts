import type { CollectionConfig } from "payload";

import { allow } from "@/access/staff";

/**
 * The change log on a job (§14 `job_events`, JOB-08).
 *
 * §14 is explicit: "rows can only be added, never edited". That is why update
 * and delete are closed to everyone including the owner — an audit trail that
 * can be rewritten is not an audit trail, and this is the record that answers
 * "who moved this booking, and when?".
 */
export const JobEvents: CollectionConfig = {
  slug: "job-events",
  admin: {
    useAsTitle: "type",
    defaultColumns: ["job", "type", "field", "createdAt"],
    description: "Append-only history. Rows are never edited or removed.",
  },
  access: {
    read: allow("jobs.view"),
    create: allow("jobs.edit"),
    update: () => false, // append-only (§14)
    delete: () => false,
  },
  fields: [
    {
      name: "job",
      type: "relationship",
      relationTo: "jobs",
      required: true,
      index: true,
    },
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        { label: "Created", value: "created" },
        { label: "Updated", value: "updated" },
        { label: "Assigned", value: "assigned" },
        { label: "Unassigned", value: "unassigned" },
        { label: "Status changed", value: "status_changed" },
        { label: "Message sent", value: "message_sent" },
      ],
    },
    { name: "field", type: "text" },
    { name: "oldValue", type: "text" },
    { name: "newValue", type: "text" },
    {
      name: "actorType",
      type: "select",
      required: true,
      options: [
        { label: "Staff user", value: "user" },
        { label: "System", value: "system" },
        { label: "Customer", value: "customer" },
      ],
    },
    { name: "actorUser", type: "relationship", relationTo: "users" },
  ],
};
