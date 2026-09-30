import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { londonDay } from "@/admin/format";
import { DriverForm, type DriverFormValues } from "@/admin/forms/driver-form";
import { requireStaff, segment } from "@/admin/guard";
import { ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";

/** Adding a driver (`/drivers/new`) or editing one (`/drivers/:id/edit`). */

const day = (value: string | null | undefined) =>
  value ? londonDay(new Date(value)) : "";

export async function DriverEditView(props: AdminViewServerProps) {
  const idSegment = segment(props, 1);
  const isNew = idSegment === "new";
  const context = requireStaff(
    props,
    "drivers.edit",
    isNew ? "/admin/drivers/new" : `/admin/drivers/${idSegment}/edit`,
  );
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;

  let values: DriverFormValues = {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    address: "",
    dateOfBirth: "",
    status: "active",
    employmentType: "self_employed",
    startDate: "",
    endDate: "",
    payRule: "fixed",
    payFixed: "",
    payPercent: "",
    showPayInMessages: "default",
    whatsappConsent: false,
    notes: "",
  };

  if (!isNew) {
    const driver = await payload.findByID({
      collection: "drivers",
      id: Number(idSegment),
      depth: 0,
      user,
      overrideAccess: false,
      disableErrors: true,
    });
    if (!driver) {
      return (
        <OpsShell user={user} active="drivers">
          <Panel>
            <EmptyState
              title="No driver with that number"
              action={<ButtonLink href="/admin/drivers">Back to drivers</ButtonLink>}
            />
          </Panel>
        </OpsShell>
      );
    }
    values = {
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      phone: driver.phone,
      email: driver.email ?? "",
      address: driver.address ?? "",
      dateOfBirth: day(driver.dateOfBirth),
      status: driver.status,
      employmentType: driver.employmentType,
      startDate: day(driver.startDate),
      endDate: day(driver.endDate),
      payRule: driver.payRule,
      payFixed: driver.payFixedPence ? (driver.payFixedPence / 100).toFixed(2) : "",
      payPercent: driver.payPercentBp ? String(driver.payPercentBp / 100) : "",
      showPayInMessages: driver.showPayInMessages,
      whatsappConsent: Boolean(driver.whatsappConsentAt),
      notes: driver.notes ?? "",
    };
  }

  const back = isNew ? "/admin/drivers" : `/admin/drivers/${idSegment}`;
  return (
    <OpsShell user={user} active="drivers">
      <div className="mb-3">
        <Link
          href={back}
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {isNew ? "Drivers" : values.firstName + " " + values.lastName}
        </Link>
      </div>
      <PageHeader
        title={isNew ? "Add a driver" : "Edit driver"}
        description={
          isNew
            ? "Documents are added on the driver's page once they are saved."
            : undefined
        }
      />
      <Panel bodyClassName="p-5">
        <DriverForm values={values} cancelHref={back} />
      </Panel>
    </OpsShell>
  );
}
