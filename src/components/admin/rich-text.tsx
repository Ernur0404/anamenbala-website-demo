"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";

function ToolButton({ onClick, active, label, children, disabled }: { onClick: () => void; active?: boolean; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn("grid size-8 place-items-center rounded-md text-ink-600 transition-colors hover:bg-sage-50 hover:text-sage-800 disabled:opacity-40", active && "bg-sage-100 text-sage-800")}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const t = useTranslations("admin.common.editor");
  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("linkPrompt"), previous ?? "https://");
    if (url === null) return;
    if (!url || url === "https://") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-cream/70 px-2 py-1.5">
      <ToolButton label={t("bold")} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </ToolButton>
      <ToolButton label={t("italic")} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-line" />
      <ToolButton label={t("h2")} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-4" />
      </ToolButton>
      <ToolButton label={t("h3")} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="size-4" />
      </ToolButton>
      <ToolButton label={t("bullet")} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-4" />
      </ToolButton>
      <ToolButton label={t("ordered")} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </ToolButton>
      <ToolButton label={t("quote")} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-line" />
      <ToolButton label={t("link")} active={editor.isActive("link")} onClick={setLink}>
        <Link2 className="size-4" />
      </ToolButton>
      {editor.isActive("link") && (
        <ToolButton label={t("unlink")} onClick={() => editor.chain().focus().unsetLink().run()}>
          <Unlink className="size-4" />
        </ToolButton>
      )}
      <span className="ml-auto" />
      <ToolButton label={t("undo")} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="size-4" />
      </ToolButton>
      <ToolButton label={t("redo")} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="size-4" />
      </ToolButton>
    </div>
  );
}

/** Редактор текста (описания товаров, страницы): заголовки, списки, ссылки. HTML очищается на сервере */
export function RichTextEditor({ value, onChange, minHeight = 180, className }: { value: string; onChange: (html: string) => void; minHeight?: number; className?: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } })],
    content: value || "",
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
    editorProps: {
      attributes: { class: "rich-text max-w-none px-4 py-3 text-[14.5px] outline-none", style: `min-height:${minHeight}px` },
    },
  });

  return (
    <div className={cn("overflow-hidden rounded-lg border border-line-strong bg-white focus-within:border-sage-500 focus-within:ring-3 focus-within:ring-sage-500/15", className)}>
      {editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b border-line bg-cream/70" />}
      <EditorContent editor={editor} />
    </div>
  );
}
