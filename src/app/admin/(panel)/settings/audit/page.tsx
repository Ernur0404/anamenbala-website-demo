import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { AUDIT_GROUPS, AUDIT_PAGE_SIZE, auditGroup, auditLink, listAuditLog } from "@/server/admin/audit-log";
import { DataTable, EmptyRow, PageHeader, Pagination, Panel, Td, Th, Tr } from "@/components/admin/ui";
import { ParamSelect } from "@/components/admin/controls";
import { param, pageParam, type SearchParams } from "@/components/admin/url";
import { formatDateTime } from "@/lib/dates";
import { SettingsNav } from "../settings-nav";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings.tabs");
  return { title: t("audit") };
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff("audit");
  const sp = await searchParams;
  const [t, ts, tc, locale] = await Promise.all([getTranslations("admin.settings.audit"), getTranslations("admin.settings"), getTranslations("admin.common"), getLocale()]);
  const staffId = param(sp, "staff");
  const group = param(sp, "group");
  const page = pageParam(sp);
  const [{ rows, total }, staff] = await Promise.all([
    listAuditLog({ staffId, group }, page),
    db.staffUser.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title={ts("title")} subtitle={ts("subtitle")} />
      <SettingsNav active="audit" />
      <Panel title={t("title")} subtitle={t("hint")} serif padded={false}>
        <div className="grid gap-3 border-t border-line px-5 py-4 sm:grid-cols-2 sm:px-6 lg:max-w-2xl">
          <ParamSelect param="staff" allLabel={t("allStaff")} options={staff.map((s) => ({ value: s.id, label: s.name }))} />
          <ParamSelect param="group" allLabel={t("allTypes")} options={Object.keys(AUDIT_GROUPS).map((g) => ({ value: g, label: t(`groups.${g}`) }))} />
        </div>
        <DataTable minWidth={820}>
          <thead className="bg-cream/60">
            <tr>
              <Th className="w-40">{t("when")}</Th>
              <Th className="w-44">{t("who")}</Th>
              <Th className="w-40">{t("section")}</Th>
              <Th>{t("action")}</Th>
              <Th className="w-32">{t("ip")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5} title={staffId || group ? tc("nothingFound") : t("empty")} />}
            {rows.map((r) => {
              const href = auditLink(r);
              return (
                <Tr key={r.id}>
                  <Td className="whitespace-nowrap text-ink-600">{formatDateTime(r.createdAt, locale)}</Td>
                  <Td className="font-semibold text-graphite">{r.staffUser?.name ?? <span className="font-normal text-ink-500">{t("system")}</span>}</Td>
                  <Td className="text-ink-600">{t(`groups.${auditGroup(r.entityType)}`)}</Td>
                  <Td>
                    {href ? (
                      <Link href={href} className="group inline-flex items-start gap-1 text-graphite hover:text-sage-700">
                        {r.summary}
                        <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-ink-400 group-hover:text-sage-700" />
                      </Link>
                    ) : (
                      <span className="text-graphite">{r.summary}</span>
                    )}
                    <span className="block font-mono text-[11px] text-ink-400">{r.action}</span>
                  </Td>
                  <Td className="font-mono text-[12px] whitespace-nowrap text-ink-500">{r.ip ?? "—"}</Td>
                </Tr>
              );
            })}
          </tbody>
        </DataTable>
        <Pagination path="/admin/settings/audit" searchParams={sp} page={page} pageSize={AUDIT_PAGE_SIZE} total={total} shownLabel={(from, to, all) => tc("shown", { from, to, total: all })} />
      </Panel>
    </>
  );
}
