import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ExternalLink, Pencil, Plus } from "lucide-react";
import { requireStaff } from "@/server/auth/staff";
import { db } from "@/server/db";
import { DataTable, PageHeader, Panel, Td, Th, Tr } from "@/components/admin/ui";
import { StatusPill } from "@/components/ui/display";
import { buttonVariants } from "@/components/ui/button";
import { ContentNav } from "../content-nav";
import { pagePath } from "./page-path";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.content");
  return { title: t("pages.title") };
}

export default async function PagesPage() {
  await requireStaff("content");
  const t = await getTranslations("admin.content");
  const tc = await getTranslations("admin.common");
  const pages = await db.page.findMany({ orderBy: [{ isSystem: "desc" }, { titleRu: "asc" }], select: { id: true, slug: true, template: true, titleRu: true, isPublished: true, isSystem: true, showInFooter: true } });
  const content = pages.filter((p) => p.template !== "HERO_ONLY");
  const heroOnly = pages.filter((p) => p.template === "HERO_ONLY");

  const table = (rows: typeof pages) => (
    <DataTable minWidth={640}>
      <thead className="bg-cream/60">
        <tr>
          <Th>{t("pages.columns.name")}</Th>
          <Th>{t("pages.columns.url")}</Th>
          <Th>{t("pages.columns.status")}</Th>
          <Th align="right">{tc("actions")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <Tr key={p.id}>
            <Td>
              <Link href={`/admin/content/pages/${p.id}`} className="font-semibold text-graphite hover:text-sage-700">
                {p.titleRu}
              </Link>
              {p.isSystem && <span className="ml-2 text-[11.5px] text-ink-400">{t("pages.system")}</span>}
            </Td>
            <Td className="font-mono text-[12.5px] text-ink-600">{pagePath(p)}</Td>
            <Td>
              <StatusPill tone={p.isPublished ? "sage" : "gray"}>{p.isPublished ? t("pages.published") : t("pages.draft")}</StatusPill>
            </Td>
            <Td align="right">
              <div className="inline-flex gap-1.5">
                <a href={pagePath(p)} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700" aria-label={t("pages.open")}>
                  <ExternalLink className="size-3.5" />
                </a>
                <Link href={`/admin/content/pages/${p.id}`} className="grid size-8 place-items-center rounded-md border border-line bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700" aria-label={tc("edit")}>
                  <Pencil className="size-3.5" />
                </Link>
              </div>
            </Td>
          </Tr>
        ))}
      </tbody>
    </DataTable>
  );

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ContentNav active="pages" />
      <div className="space-y-5">
        <Panel
          title={t("pages.title")}
          serif
          padded={false}
          action={
            <Link href="/admin/content/pages/new" className={buttonVariants({ size: "sm" })}>
              <Plus />
              {t("pages.add")}
            </Link>
          }
        >
          {table(content)}
        </Panel>
        <Panel title={t("pages.heroOnly")} subtitle={t("pages.heroOnlyHint")} serif padded={false}>
          {table(heroOnly)}
        </Panel>
      </div>
    </>
  );
}
