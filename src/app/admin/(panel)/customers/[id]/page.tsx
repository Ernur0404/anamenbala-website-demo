import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Mail, MapPin, Phone, Plus, UserRound } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { customerStatus, getCustomer } from "@/server/admin/customers";
import { getStatusLabels } from "@/server/admin/statuses";
import { DataTable, InfoRow, PageHeader, Panel, Td, Th, Tr } from "@/components/admin/ui";
import { StatusPill } from "@/components/ui/display";
import { buttonVariants } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPhone, telLink, whatsappLink } from "@/lib/phone";
import { CustomerEditor, NotesEditor } from "./customer-editors";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getCustomer(id);
  const t = await getTranslations("admin.customers");
  return { title: data?.customer.name ?? t("title") };
}

const TONE = { new: "sky", active: "sage", inactive: "gray" } as const;

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("customers");
  const { id } = await params;
  const data = await getCustomer(id);
  if (!data) notFound();
  const { customer, stats } = data;
  const locale = await getLocale();
  const t = await getTranslations("admin.customers");
  const to = await getTranslations("admin.orders");
  const labels = await getStatusLabels(locale);
  const status = customerStatus({ createdAt: customer.createdAt, lastOrderAt: stats.lastOrderAt });
  const addresses = customer.users.flatMap((u) => u.addresses);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/customers", label: t("title") }}
        title={customer.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill tone={TONE[status]}>{t(`status.${status}`)}</StatusPill>
            {t("card.since", { date: formatDate(customer.createdAt, locale) })}
          </span>
        }
        actions={
          <>
            <a href={whatsappLink(customer.phone)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary" })}>
              <WhatsAppIcon size={16} />
              WhatsApp
            </a>
            <Link href="/admin/orders/new" className={buttonVariants()}>
              <Plus />
              {t("card.newOrder")}
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Panel title={t("card.stats")}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: t("card.ordersCount"), value: stats.orders },
                { label: t("card.spent"), value: formatMoney(stats.spent) },
                { label: t("card.avg"), value: stats.orders ? formatMoney(stats.avg) : "—" },
                { label: t("card.lastOrder"), value: stats.lastOrderAt ? formatDate(stats.lastOrderAt, locale) : "—" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-cream px-4 py-3">
                  <p className="text-[12px] text-ink-500">{s.label}</p>
                  <p className="mt-1 text-[18px] font-bold text-graphite">{s.value}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={t("card.orders")} padded={false}>
            <DataTable minWidth={600}>
              <thead className="bg-cream/60">
                <tr>
                  <Th>{to("columns.number")}</Th>
                  <Th>{to("columns.date")}</Th>
                  <Th align="right">{to("columns.sum")}</Th>
                  <Th>{to("columns.status")}</Th>
                  <Th>{to("columns.payment")}</Th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((o) => (
                  <Tr key={o.id}>
                    <Td>
                      <Link href={`/admin/orders/${o.id}`} className="font-bold text-graphite hover:text-sage-700">
                        #{o.number}
                      </Link>
                      {o.channel !== "WEBSITE" && <span className="ml-2 text-[11.5px] text-ink-500">{to(`channel.${o.channel}`)}</span>}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-600">{formatDateTime(o.createdAt, locale)}</Td>
                    <Td align="right" className="font-semibold">
                      {formatMoney(o.total)}
                    </Td>
                    <Td>
                      <StatusPill tone={labels.order[o.status].tone}>{labels.order[o.status].label}</StatusPill>
                    </Td>
                    <Td>
                      <StatusPill tone={labels.payment[o.paymentStatus].tone}>{labels.payment[o.paymentStatus].label}</StatusPill>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </Panel>

          <Panel title={t("card.notes")}>
            <NotesEditor id={customer.id} initial={customer.notes ?? ""} />
          </Panel>
        </div>

        <div className="space-y-5 xl:sticky xl:top-24">
          <Panel
            title={
              <span className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-sage-700 text-white">
                  <UserRound className="size-5" />
                </span>
                {customer.name}
              </span>
            }
            action={<CustomerEditor customer={{ id: customer.id, name: customer.name, email: customer.email ?? "", city: customer.city ?? "" }} />}
          >
            <ul className="space-y-2.5 text-[13.5px]">
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 text-ink-400" />
                <a href={telLink(customer.phone)} className="text-graphite hover:text-sage-700">
                  {formatPhone(customer.phone)}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 text-ink-400" />
                <span className="text-graphite">{customer.email ?? "—"}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="size-4 text-ink-400" />
                <span className="text-graphite">{customer.city ?? "—"}</span>
              </li>
            </ul>
            <div className="mt-4 border-t border-line pt-3">
              {customer.users.length ? (
                customer.users.map((u) => (
                  <InfoRow key={u.id} label={t("card.accountLabel")}>
                    {u.email}
                    {u.emailVerifiedAt && <span className="ml-1 text-[11.5px] text-sage-700">· {t("card.verified")}</span>}
                  </InfoRow>
                ))
              ) : (
                <p className="text-[12.5px] text-ink-500">{t("card.noAccount")}</p>
              )}
            </div>
          </Panel>

          <Panel title={t("card.addresses")}>
            {addresses.length === 0 ? (
              <p className="text-[13px] text-ink-500">{t("card.noAddresses")}</p>
            ) : (
              <ul className="space-y-2 text-[13px] text-ink-700">
                {addresses.map((a) => (
                  <li key={a.id} className="rounded-lg bg-cream px-3 py-2">
                    {[a.region, a.city, `${a.street}, ${a.house}`, a.apartment && `кв. ${a.apartment}`, a.postalCode].filter(Boolean).join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
