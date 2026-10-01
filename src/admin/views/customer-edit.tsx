import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { CustomerForm, type CustomerFormValues } from "@/admin/forms/customer-form";
import { requireStaff, segment } from "@/admin/guard";
import { ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";

/** Adding a customer (`/customers/new`) or correcting one (`/customers/:id/edit`). */
export async function CustomerEditView(props: AdminViewServerProps) {
  const idSegment = segment(props, 1);
  const isNew = idSegment === "new";
  const context = requireStaff(
    props,
    "customers.edit",
    isNew ? "/admin/customers/new" : `/admin/customers/${idSegment}/edit`,
  );
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;

  let values: CustomerFormValues = { name: "", phone: "", email: "", notes: "" };
  if (!isNew) {
    const customer = await payload.findByID({
      collection: "customers",
      id: Number(idSegment),
      depth: 0,
      user,
      overrideAccess: false,
      disableErrors: true,
    });
    if (!customer) {
      return (
        <OpsShell user={user} active="customers">
          <Panel>
            <EmptyState
              title="No customer with that number"
              action={<ButtonLink href="/admin/customers">Back to customers</ButtonLink>}
            />
          </Panel>
        </OpsShell>
      );
    }
    values = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? "",
      notes: customer.notes ?? "",
    };
  }

  const back = isNew ? "/admin/customers" : `/admin/customers/${idSegment}`;
  return (
    <OpsShell user={user} active="customers">
      <div className="mb-3">
        <Link
          href={back}
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {isNew ? "Customers" : values.name}
        </Link>
      </div>
      <PageHeader
        title={isNew ? "Add customer" : `Edit ${values.name}`}
        description={
          isNew
            ? "Usually not needed: phone, WhatsApp and email bookings record their customer themselves."
            : undefined
        }
      />
      <Panel>
        <CustomerForm values={values} cancelHref={back} />
      </Panel>
    </OpsShell>
  );
}
