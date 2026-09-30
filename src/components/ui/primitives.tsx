"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Accordion as AccordionPrimitive, Dialog as DialogPrimitive, Switch as SwitchPrimitive, Tabs as TabsPrimitive, Tooltip as TooltipPrimitive } from "radix-ui";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ───────────── Dialog / Sheet ─────────────

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  hideTitle,
  size = "md",
  ...props
}: Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "title"> & { title: ReactNode; description?: ReactNode; hideTitle?: boolean; size?: "sm" | "md" | "lg" | "xl" }) {
  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-graphite/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-5 shadow-pop outline-none data-[state=open]:animate-slide-up sm:p-7",
          width,
          className,
        )}
        {...props}
      >
        <div className={cn("mb-4 pr-8", hideTitle && "sr-only")}>
          <DialogPrimitive.Title className="heading-section text-2xl">{title}</DialogPrimitive.Title>
          {description && <DialogPrimitive.Description className="mt-1 text-sm text-ink-500">{description}</DialogPrimitive.Description>}
        </div>
        {!description && <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : ""}</DialogPrimitive.Description>}
        {children}
        <DialogPrimitive.Close className="absolute top-4 right-4 grid size-9 place-items-center rounded-full text-ink-500 transition-colors hover:bg-beige-100 hover:text-graphite" aria-label="Закрыть">
          <X className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Выезжающая панель: снизу на телефоне (bottom sheet), сбоку на компьютере */
export function SheetContent({
  className,
  children,
  title,
  side = "right",
  footer,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "title"> & { title: ReactNode; side?: "right" | "left" | "bottom"; footer?: ReactNode }) {
  const position = {
    right: "inset-y-0 right-0 h-dvh w-[min(420px,92vw)] data-[state=open]:animate-slide-in-right",
    left: "inset-y-0 left-0 h-dvh w-[min(380px,88vw)] data-[state=open]:animate-slide-in-left",
    bottom: "inset-x-0 bottom-0 max-h-[88dvh] w-full rounded-t-2xl data-[state=open]:animate-slide-up",
  }[side];
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-graphite/40 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content className={cn("fixed z-50 flex flex-col bg-cream shadow-pop outline-none", position, className)} {...props}>
        {side === "bottom" && <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong" aria-hidden />}
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <DialogPrimitive.Title className="heading-section text-2xl">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : ""}</DialogPrimitive.Description>
          <DialogPrimitive.Close className="grid size-9 place-items-center rounded-full text-ink-500 hover:bg-beige-100 hover:text-graphite" aria-label="Закрыть">
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line bg-white px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// ───────────── Tabs ─────────────

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("scrollbar-none flex gap-1 overflow-x-auto border-b border-line", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-ink-500 transition-colors hover:text-graphite data-[state=active]:border-sage-700 data-[state=active]:text-graphite",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn("pt-5 outline-none", className)} {...props} />;
});

/** Вкладки-«пилюли» как в админке макета */
export function PillTabsList({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("scrollbar-none flex gap-1.5 overflow-x-auto rounded-lg bg-white p-1 ring-1 ring-line", className)} {...props} />;
}

export function PillTabsTrigger({ className, ...props }: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "shrink-0 rounded-md px-4 py-2 text-[13px] font-semibold text-ink-600 transition-colors hover:bg-beige-50 data-[state=active]:bg-sage-700 data-[state=active]:text-white",
        className,
      )}
      {...props}
    />
  );
}

// ───────────── Accordion ─────────────

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ className, ...props }: ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn("border-b border-line last:border-b-0", className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn("group flex flex-1 items-center justify-between gap-4 py-4 text-left text-[15px] font-semibold text-graphite transition-colors hover:text-sage-700", className)}
        {...props}
      >
        {children}
        <ChevronDown className="size-4 shrink-0 text-ink-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, children, ...props }: ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content className="overflow-hidden" {...props}>
      <div className={cn("pb-4 text-sm leading-relaxed text-ink-600", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

// ───────────── Switch ─────────────

export function Switch({ className, ...props }: ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-line-strong transition-colors data-[state=checked]:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  );
}

// ───────────── Tooltip ─────────────

export function Tooltip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content side={side} sideOffset={6} className="z-50 max-w-xs rounded-md bg-graphite px-2.5 py-1.5 text-xs text-white shadow-pop">
            {content}
            <TooltipPrimitive.Arrow className="fill-graphite" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
