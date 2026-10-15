import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { OperatorForm, type OperatorFormValues } from "@/admin/forms/operator-form";
import { requireStaff, segment } from "@/admin/guard";
import { ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { londonDateAndTime } from "@/lib/time";
import type { Operator } from "@/payload-types";

const day = (iso: string | null | undefined) =>
  iso ? londonDateAndTime(new Date(iso)).date : "";

/** Adding a subcontracting operator (`/operators/new`) or editing one. */
export async function OperatorEditView(props: AdminViewServerProps) {
  const idSegment = segment(props, 1);
  const isNew = idSegment === "new";
  const context = requireStaff(
    props,
    "operators.edit",
    isNew ? "/admin/operators/new" : `/admin/operators/${idSegment}/edit`,
  );
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;

  let values: OperatorFormValues = {
    name: "",
    legalName: "",
    licensedFrom: "tfl",
    licensingAuthority: "",
    licenceNumber: "",
    licenceExpiresAt: "",
    hasLicenceCopy: false,
    operatingCentre: "",
    contactName: "",
    phone: "",
    email: "",
    whatsappConsent: false,
    dateJoined: "",
    dateLeft: "",
    companyNumber: "",
    vatNumber: "",
    notes: "",
  };

  if (!isNew) {
    const operator = (await payload.findByID({
      collection: "operators",
      id: Number(idSegment),
      depth: 0,
      user,
      overrideAccess: false,
      disableErrors: true,
    })) as Operator | null;
    if (!operator) {
      return (
        <OpsShell user={user} active="operators">
          <Panel>
            <EmptyState
              title="No operator with that number"
              action={<ButtonLink href="/admin/operators">Back to operators</ButtonLink>}
            />
          </Panel>
        </OpsShell>
      );
    }
    values = {
      id: operator.id,
      name: operator.name,
      legalName: operator.legalName ?? "",
      licensedFrom: operator.licensedFrom,
      licensingAuthority: operator.licensingAuthority ?? "",
      licenceNumber: operator.licenceNumber ?? "",
      licenceExpiresAt: day(operator.licenceExpiresAt),
      hasLicenceCopy: Boolean(operator.licenceCopy),
      operatingCentre: operator.operatingCentre ?? "",
      contactName: operator.contactName ?? "",
      phone: operator.phone,
      email: operator.email ?? "",
      whatsappConsent: Boolean(operator.whatsappConsentAt),
      dateJoined: day(operator.dateJoined),
      dateLeft: day(operator.dateLeft),
      companyNumber: operator.companyNumber ?? "",
      vatNumber: operator.vatNumber ?? "",
      notes: operator.notes ?? "",
    };
  }

  const back = isNew ? "/admin/operators" : `/admin/operators/${idSegment}`;
  return (
    <OpsShell user={user} active="operators">
      <div className="mb-3">
        <Link
          href={back}
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {isNew ? "Subcontracting operators" : values.name}
        </Link>
      </div>
      <PageHeader title={isNew ? "Add an operator" : "Edit operator"} />
      <Panel bodyClassName="p-5">
        <OperatorForm values={values} cancelHref={back} />
      </Panel>
    </OpsShell>
  );
}
