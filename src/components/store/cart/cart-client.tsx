"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, ImageOff, Leaf, Tag, Trash2, Truck, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/display";
import { QuantityStepper } from "@/components/ui/quantity";
import { applyPromoAction, clearCartAction, removeFromCartAction, removePromoAction, setCartQuantityAction } from "@/server/actions/store";
import type { CartLineView, CartView } from "@/server/cart-view";
import { useStore } from "../store-provider";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function CartLine({ line, compact, onChanged }: { line: CartLineView; compact?: boolean; onChanged: () => void }) {
  const t = useTranslations("cart");
  const { setCartCount } = useStore();
  const [pending, startTransition] = useTransition();

  const setQty = (quantity: number) =>
    startTransition(async () => {
      const result = await setCartQuantityAction(line.variantId, quantity);
      if (result.ok) setCartCount(result.data.count);
      onChanged();
    });
  const remove = () =>
    startTransition(async () => {
      const result = await removeFromCartAction(line.variantId);
      if (result.ok) setCartCount(result.data.count);
      onChanged();
    });

  return (
    <div className={cn("relative flex gap-3 sm:gap-4", compact ? "py-3" : "rounded-xl border border-line bg-white p-3 sm:p-4", pending && "opacity-60", line.problem && !compact && "border-powder-300")}>
      <Link href={`/product/${line.slug}`} className={cn("relative shrink-0 overflow-hidden rounded-md bg-beige-50", compact ? "size-16" : "size-24 sm:size-28")}>
        {line.image ? <Image src={line.image.src} alt={line.image.alt} fill sizes="112px" className="object-cover" /> : <ImageOff className="m-auto mt-8 size-6 text-beige-400" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <Link href={`/product/${line.slug}`} className={cn("line-clamp-2 font-semibold leading-snug hover:text-sage-700", compact ? "text-[13px]" : "text-sm sm:text-[15px]")}>
            {line.name}
          </Link>
          {line.variantLabel && <p className="mt-1 text-xs text-ink-500">{line.variantLabel}</p>}
          {!compact && <Price className="mt-1.5" size="sm" value={line.finalUnit} oldValue={line.regularUnit} />}
          {line.problem === "OUT_OF_STOCK" && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-powder-700">
              <AlertTriangle className="size-3.5" />
              {t("notEnough", { count: line.stock })}
            </p>
          )}
          {line.problem === "VARIANT_UNAVAILABLE" && <p className="mt-1.5 text-xs font-semibold text-powder-700">{t("unavailable")}</p>}
          {line.backorderQty > 0 && !line.problem && <p className="mt-1.5 text-xs font-medium text-sky-700">{t("backorderNote", { count: line.backorderQty })}</p>}
        </div>
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
          {line.problem !== "VARIANT_UNAVAILABLE" && (
            <QuantityStepper size="sm" value={line.quantity} onChange={setQty} max={Math.max(line.maxQuantity, line.quantity)} disabled={pending} />
          )}
          <span className="text-[15px] font-bold whitespace-nowrap">{formatMoney(line.lineTotal)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={remove}
        className={cn("grid size-8 shrink-0 place-items-center rounded-full text-ink-400 transition-colors hover:bg-beige-100 hover:text-powder-700", !compact && "absolute top-2 right-2 sm:static")}
        aria-label={t("remove")}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function PromoForm({ promo, error }: { promo: CartView["promo"]; error: CartView["promoError"] }) {
  const t = useTranslations();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  const errorText = (code: string, minOrderAmount?: number) =>
    code === "PROMO_MIN_AMOUNT" && minOrderAmount ? t("errors.PROMO_MIN_AMOUNT", { amount: formatMoney(minOrderAmount) }) : t(`errors.${code}`);

  if (promo) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-sage-50 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-sage-800">
          <Tag className="size-4" />
          {t("cart.promoApplied", { code: promo.code })}
        </span>
        <button
          type="button"
          className="text-xs font-semibold text-ink-500 hover:text-powder-700"
          onClick={() =>
            startTransition(async () => {
              await removePromoAction();
              router.refresh();
            })
          }
        >
          {t("cart.promoRemove")}
        </button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await applyPromoAction(code);
          if (result.ok) {
            toast.success(t("cart.promoApplied", { code: result.data.code }));
            setCode("");
            router.refresh();
          } else toast.error(errorText(result.code, result.details?.minOrderAmount as number | undefined));
        });
      }}
    >
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t("cart.promoPlaceholder")}
          aria-label={t("cart.promo")}
          className="h-11 min-w-0 flex-1 rounded-md border border-line-strong bg-white px-3.5 text-sm tracking-wide uppercase outline-none placeholder:normal-case placeholder:tracking-normal focus:border-sage-500 focus:ring-3 focus:ring-sage-500/15"
        />
        <Button type="submit" loading={pending} disabled={!code.trim()}>
          {t("cart.promoApply")}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-powder-700">{errorText(error.code, error.minOrderAmount)}</p>}
    </form>
  );
}

export function FreeDeliveryBanner({ threshold, itemsTotal }: { threshold: number | null; itemsTotal: number }) {
  const t = useTranslations("cart");
  if (!threshold) return null;
  const left = Math.max(0, threshold - itemsTotal);
  const progress = Math.min(100, Math.round((itemsTotal / threshold) * 100));
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-beige-100 to-sage-100 p-5">
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/70 text-sage-700">
          <Truck className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="heading-section text-[22px] leading-tight">{t("freeDelivery")}</p>
          <p className="text-sm text-ink-600">{left > 0 ? t("freeDeliveryLeft", { amount: formatMoney(left) }) : t("freeDeliveryReached")}</p>
        </div>
        <Leaf className="hidden size-10 text-sage-400 sm:block" />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full bg-sage-600 transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function CartClient({ cart }: { cart: CartView }) {
  const t = useTranslations("cart");
  const router = useRouter();
  const { setCartCount } = useStore();
  const [pending, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-500">{t("selected", { count: cart.itemsCount })}</p>
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-powder-700"
            onClick={() => {
              if (!confirm(t("clearConfirm"))) return;
              startTransition(async () => {
                await clearCartAction();
                setCartCount(0);
                router.refresh();
              });
            }}
          >
            <Trash2 className="size-4" />
            {t("clear")}
          </button>
        </div>
        {cart.lines.map((line) => (
          <CartLine key={line.variantId} line={line} onChanged={refresh} />
        ))}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-white p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Tag className="size-4 text-sage-700" />
              {t("promo")}
            </p>
            <PromoForm promo={cart.promo} error={cart.promoError} />
          </div>
          <FreeDeliveryBanner threshold={cart.freeDeliveryThreshold} itemsTotal={cart.itemsTotal} />
        </div>
      </div>

      <aside className={cn("rounded-xl border border-line bg-white p-5 sm:p-6 lg:sticky lg:top-[150px]", pending && "opacity-70")}>
        <h2 className="heading-section text-[28px]">{t("total")}</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-600">{t("items", { count: cart.itemsCount })}</dt>
            <dd className="font-semibold">{formatMoney(cart.itemsRegular)}</dd>
          </div>
          {cart.itemsDiscount > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-600">{t("discount")}</dt>
              <dd className="font-semibold text-powder-700">−{formatMoney(cart.itemsDiscount)}</dd>
            </div>
          )}
          {cart.promo && (
            <div className="flex justify-between">
              <dt className="text-ink-600">{t("promoDiscount", { code: cart.promo.code })}</dt>
              <dd className="font-semibold text-powder-700">−{formatMoney(cart.promo.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-600">{t("delivery")}</dt>
            <dd className="font-semibold">{cart.freeDeliveryThreshold && cart.itemsTotal >= cart.freeDeliveryThreshold ? t("deliveryFree") : t("deliveryLater")}</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-base font-semibold">{t("toPay")}</span>
          <span className="text-[26px] font-bold tracking-tight">{formatMoney(cart.total)}</span>
        </div>
        {cart.hasProblems && <p className="mt-3 rounded-md bg-powder-50 p-3 text-xs font-medium text-powder-800">{t("fixProblems")}</p>}
        <Button asChild={!cart.hasProblems} block size="lg" className="mt-5" disabled={cart.hasProblems}>
          {cart.hasProblems ? <span>{t("checkout")}</span> : <Link href="/checkout">{t("checkout")}</Link>}
        </Button>
      </aside>
    </div>
  );
}
