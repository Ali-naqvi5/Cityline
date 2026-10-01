import { Plus, Search } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps, Where } from "payload";

import { loadCustomerSummaries } from "@/admin/data/customers";
import { money, shortDay } from "@/admin/format";
import { param, requireStaff } from "@/admin/guard";
import { DataTable, NumberedPagination } from "@/components/ops/data-table";
import { FilterForm } from "@/components/ops/filter-form";
import { Checkbox, Label, Select, TextInput } from "@/components/ops/form-controls";
import {
  Badge,
  buttonClass,
  ButtonLink,
  NotRecorded,
  PageHeader,
  Panel,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { can } from "@/domain/staff/permissions";
import type { Customer } from "@/payload-types";

/**
 * Customers (Cityline, 2 Oct 2026): everyone who books with Cityline
 * directly — online, or by phone, WhatsApp or email — with their history in
 * figures. Supplier passengers are the supplier's customers and are not here.
 */

const PAGE_SIZE = 30;

const SORTS = {
  recent: { label: "Newest first", sort: "-createdAt" },
  name: { label: "Name A–Z", sort: "name" },
} as const;
type SortKey = keyof typeof SORTS;

function searchConditions(q: string): Where[] {
  const term = q.trim();
  if (!term) return [];
  const conditions: Where[] = [{ name: { like: term } }, { email: { like: term } }];
  if (/^[\d\s+()-]+$/.test(term)) {
    const national = term.replace(/\D/g, "").replace(/^44/, "").replace(/^0+/, "");
    if (national.length >= 6) conditions.push({ phone: { like: national } });
  }
  return conditions;
}

export async function CustomersView(props: AdminViewServerProps) {
  const context = requireStaff(props, "customers.view", "/admin/customers");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const q = param(props.searchParams, "q").slice(0, 80);
  const consent = param(props.searchParams, "consent") === "1";
  const includeTest = param(props.searchParams, "test") === "1";
  const sortParam = param(props.searchParams, "sort");
  const sort: SortKey = sortParam in SORTS ? (sortParam as SortKey) : "recent";
  const page = Math.max(1, Number.parseInt(param(props.searchParams, "page"), 10) || 1);

  const and: Where[] = [];
  if (!includeTest) and.push({ isTest: { not_equals: true } });
  if (consent) and.push({ marketingConsent: { equals: true } });
  const search = searchConditions(q);
  if (search.length) and.push({ or: search });

  const result = await payload.find({
    collection: "customers",
    where: { and },
    sort: SORTS[sort].sort,
    limit: PAGE_SIZE,
    page,
    depth: 0,
    user,
    overrideAccess: false,
  });
  const summaries = await loadCustomerSummaries(
    payload,
    user,
    result.docs.map((customer) => customer.id),
    now,
  );

  const query = (change: Record<string, string>) => {
    const params = new URLSearchParams();
    const values = {
      q,
      consent: consent ? "1" : "",
      test: includeTest ? "1" : "",
      sort: sort === "recent" ? "" : sort,
      ...change,
    };
    for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
    const search = params.toString();
    return `/admin/customers${search ? `?${search}` : ""}`;
  };
  const filtered = Boolean(q || consent || includeTest);
  const edits = can(user.role, "customers.edit");

  return (
    <OpsShell user={user} active="customers">
      <PageHeader
        title="Customers"
        description="Everyone who books with Cityline directly — online, by phone, WhatsApp or email — with their whole history."
        actions={
          edits ? (
            <ButtonLink href="/admin/customers/new" variant="primary">
              <Plus aria-hidden className="h-4 w-4" />
              Add customer
            </ButtonLink>
          ) : null
        }
      />

      <Panel bodyClassName="p-0">
        <FilterForm
          action="/admin/customers"
          className="border-line grid grid-cols-1 gap-3 border-b p-4 md:grid-cols-[minmax(240px,2fr)_minmax(160px,1fr)_auto]"
        >
          <div>
            <Label htmlFor="customers-q">Search</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="text-ink-4 pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
              />
              <TextInput
                id="customers-q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Name, phone or email"
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="customers-sort">Order</Label>
            <Select id="customers-sort" name="sort" defaultValue={sort}>
              {(Object.keys(SORTS) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORTS[key].label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap items-end gap-x-4">
            <Checkbox
              id="customers-consent"
              name="consent"
              value="1"
              defaultChecked={consent}
              label="Agreed to marketing"
            />
            <Checkbox
              id="customers-test"
              name="test"
              value="1"
              defaultChecked={includeTest}
              label="Show test customers"
            />
          </div>
          <noscript>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Apply
            </button>
          </noscript>
        </FilterForm>

        {result.docs.length === 0 ? (
          <EmptyState
            title={filtered ? "No customers match" : "No customers yet"}
            description={
              filtered
                ? "Try another name, phone or email."
                : "Customers appear here when they book online, and when the office takes a phone, WhatsApp or email booking."
            }
            action={
              filtered ? (
                <ButtonLink href="/admin/customers">Clear search</ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <>
            <DataTable
              caption="Customers"
              rows={result.docs}
              rowKey={(customer: Customer) => customer.id}
              rowHref={(customer) => `/admin/customers/${customer.id}`}
              card={(customer) => {
                const summary = summaries.get(customer.id);
                return (
                  <div className="flex flex-col gap-1">
                    <p className="text-ink flex items-center gap-2 text-base font-medium">
                      {customer.name}
                      {customer.isTest ? <Badge tone="special">Test</Badge> : null}
                    </p>
                    <p className="text-ink-3 text-sm tabular-nums">
                      {customer.phone}
                      {customer.email ? ` · ${customer.email}` : ""}
                    </p>
                    <p className="text-ink-3 text-xs">
                      {summary?.bookings ?? 0} bookings
                      {summary?.nextTrip ? ` · next ${shortDay(summary.nextTrip)}` : ""}
                    </p>
                  </div>
                );
              }}
              columns={[
                {
                  key: "name",
                  header: "Customer",
                  cell: (customer) => (
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="text-ink font-medium hover:underline"
                    >
                      {customer.name}
                      {customer.isTest ? (
                        <Badge tone="special" className="ml-2">
                          Test
                        </Badge>
                      ) : null}
                    </Link>
                  ),
                },
                {
                  key: "contact",
                  header: "Phone · email",
                  cell: (customer) => (
                    <span className="text-ink-2 block max-w-64">
                      <span className="block tabular-nums">{customer.phone}</span>
                      <span className="text-ink-3 block truncate text-xs">
                        {customer.email || "No email"}
                      </span>
                    </span>
                  ),
                },
                {
                  key: "bookings",
                  header: "Bookings",
                  align: "right",
                  cell: (customer) => {
                    const summary = summaries.get(customer.id);
                    return (
                      <span className="tabular-nums">
                        {summary?.bookings ?? 0}
                        {summary?.noShows ? (
                          <span className="text-cat-4 block text-xs">
                            {summary.noShows} PNS
                          </span>
                        ) : null}
                      </span>
                    );
                  },
                },
                {
                  key: "value",
                  header: "Booked value",
                  align: "right",
                  hideBelow: "lg",
                  cell: (customer) => (
                    <span className="tabular-nums">
                      {money(summaries.get(customer.id)?.valuePence ?? 0)}
                    </span>
                  ),
                },
                {
                  key: "last",
                  header: "Last trip",
                  hideBelow: "xl",
                  cell: (customer) => {
                    const last = summaries.get(customer.id)?.lastTrip;
                    return last ? shortDay(last) : <NotRecorded>None yet</NotRecorded>;
                  },
                },
                {
                  key: "next",
                  header: "Next trip",
                  cell: (customer) => {
                    const next = summaries.get(customer.id)?.nextTrip;
                    return next ? (
                      <span className="text-ink font-medium">{shortDay(next)}</span>
                    ) : (
                      <NotRecorded>—</NotRecorded>
                    );
                  },
                },
                {
                  key: "consent",
                  header: "Marketing",
                  hideBelow: "wide",
                  cell: (customer) =>
                    customer.marketingConsent ? (
                      <Badge tone="ok">Agreed</Badge>
                    ) : (
                      <span className="text-ink-4">No</span>
                    ),
                },
              ]}
            />
            <div className="border-line border-t px-4 py-3">
              <NumberedPagination
                page={page}
                totalPages={result.totalPages}
                totalDocs={result.totalDocs}
                noun="customers"
                hrefFor={(target) => query({ page: target > 1 ? String(target) : "" })}
              />
              {result.totalPages <= 1 ? (
                <span className="text-ink-3 text-sm">
                  {result.totalDocs} {result.totalDocs === 1 ? "customer" : "customers"}
                </span>
              ) : null}
            </div>
          </>
        )}
      </Panel>
    </OpsShell>
  );
}
