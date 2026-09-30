import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { SupplierForm, type SupplierFormValues } from "@/admin/forms/supplier-form";
import { requireStaff, segment } from "@/admin/guard";
import { ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";

/** Adding a supplier (`/suppliers/new`) or editing one (`/suppliers/:id/edit`). */
export async function SupplierEditView(props: AdminViewServerProps) {
  const idSegment = segment(props, 1);
  const isNew = idSegment === "new";
  const context = requireStaff(
    props,
    "suppliers.edit",
    isNew ? "/admin/suppliers/new" : `/admin/suppliers/${idSegment}/edit`,
  );
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;

  let values: SupplierFormValues = {
    name: "",
    commissionPercent: "",
    paymentTermsDays: "30",
    contactName: "",
    email: "",
    phone: "",
    dashboardUrl: "",
    notes: "",
    active: true,
  };

  if (!isNew) {
    const supplier = await payload.findByID({
      collection: "suppliers",
      id: Number(idSegment),
      depth: 0,
      user,
      overrideAccess: false,
      disableErrors: true,
    });
    if (!supplier) {
      return (
        <OpsShell user={user} active="suppliers">
          <Panel>
            <EmptyState
              title="No supplier with that number"
              action={<ButtonLink href="/admin/suppliers">Back to suppliers</ButtonLink>}
            />
          </Panel>
        </OpsShell>
      );
    }
    values = {
      id: supplier.id,
      name: supplier.name,
      commissionPercent: String(supplier.defaultCommissionBp / 100),
      paymentTermsDays: supplier.paymentTermsDays
        ? String(supplier.paymentTermsDays)
        : "",
      contactName: supplier.contactName ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      dashboardUrl: supplier.dashboardUrl ?? "",
      notes: supplier.notes ?? "",
      active: supplier.active ?? true,
    };
  }

  const back = isNew ? "/admin/suppliers" : `/admin/suppliers/${idSegment}`;
  return (
    <OpsShell user={user} active="suppliers">
      <div className="mb-3">
        <Link
          href={back}
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {isNew ? "Suppliers" : values.name}
        </Link>
      </div>
      <PageHeader title={isNew ? "Add a supplier" : "Edit supplier"} />
      <Panel bodyClassName="p-5">
        <SupplierForm values={values} cancelHref={back} />
      </Panel>
    </OpsShell>
  );
}
