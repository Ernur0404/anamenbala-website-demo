"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronDown, LockKeyhole, MapPin, PackageCheck, ShieldCheck, Store, Truck, Wallet } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { KaspiBadge } from "@/components/ui/icons";
import { placeOrderAction } from "@/server/actions/checkout";
import type { CartView } from "@/server/cart-view";
import { CartLine, PromoForm } from "../cart/cart-client";
import { useStore } from "../store-provider";
import { formatMoney } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { formatPhoneInput } from "@/lib/phone-input";
import { cn } from "@/lib/utils";

export type CheckoutDelivery = {
  id: string;
  kind: "KAZAKHSTAN" | "LOCAL_COURIER" | "PICKUP";
  name: string;
  description: string | null;
  eta: string | null;
  price: number;
  freeFrom: number | null;
  address: string | null;
  paymentIds: string[];
};

export type CheckoutPayment = { id: string; kind: "KASPI" | "ON_DELIVERY" | "ONLINE"; name: string; description: string | null };

type Defaults = {
  name: string;
  phone: string;
  email: string;
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
};

function Step({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-3 text-lg font-bold">
        <span className="grid size-8 place-items-center rounded-full bg-sage-700 text-sm text-white">{index}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const DELIVERY_ICONS = { KAZAKHSTAN: Truck, LOCAL_COURIER: MapPin, PICKUP: Store } as const;

export function CheckoutForm({
  cart,
  deliveries,
  payments,
  defaults,
  hours,
  isLoggedIn,
}: {
  cart: CartView;
  deliveries: CheckoutDelivery[];
  payments: CheckoutPayment[];
  defaults: Defaults;
  hours: string;
  isLoggedIn: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { setCartCount } = useStore();
  const [pending, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [idempotencyKey] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ ...defaults, phone: defaults.phone ? formatPhoneInput(defaults.phone) : "", comment: "", consent: false });
  const [deliveryId, setDeliveryId] = useState(deliveries[0]?.id ?? "");

  const delivery = deliveries.find((d) => d.id === deliveryId) ?? deliveries[0];
  const allowedPayments = useMemo(() => (delivery?.paymentIds.length ? payments.filter((p) => delivery.paymentIds.includes(p.id)) : payments), [delivery, payments]);
  const [paymentId, setPaymentId] = useState(allowedPayments[0]?.id ?? "");
  const payment = allowedPayments.find((p) => p.id === paymentId) ?? allowedPayments[0];

  const deliveryPrice = delivery ? (delivery.freeFrom !== null && cart.itemsTotal >= delivery.freeFrom ? 0 : delivery.price) : 0;
  const total = cart.total + deliveryPrice;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const chooseDelivery = (id: string) => {
    setDeliveryId(id);
    const next = deliveries.find((d) => d.id === id);
    const allowed = next?.paymentIds.length ? payments.filter((p) => next.paymentIds.includes(p.id)) : payments;
    if (!allowed.some((p) => p.id === paymentId)) setPaymentId(allowed[0]?.id ?? "");
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "required";
    if (!normalizePhone(form.phone)) e.phone = "invalidPhone";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "invalidEmail";
    if (delivery?.kind === "KAZAKHSTAN" && !form.city.trim()) e.city = "required";
    if (delivery && delivery.kind !== "PICKUP") {
      if (!form.street.trim()) e.street = "required";
      if (!form.house.trim()) e.house = "required";
    }
    if (!form.consent) e.consent = "consent";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error(t("errors.VALIDATION"));
      document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    startTransition(async () => {
      const result = await placeOrderAction({
        name: form.name,
        phone: form.phone,
        email: form.email,
        deliveryMethodId: delivery.id,
        region: form.region,
        city: form.city,
        street: form.street,
        house: form.house,
        apartment: form.apartment,
        postalCode: form.postalCode,
        paymentMethodId: payment?.id ?? "",
        comment: form.comment,
        promoCode: cart.promo?.code,
        consent: true,
        idempotencyKey,
        expectedTotal: total,
      });
      if (result.ok) {
        setCartCount(0);
        router.replace(`/checkout/success/${result.data.number}?t=${result.data.accessToken}`);
        return;
      }
      if (result.code === "PRICE_CHANGED") {
        toast.warning(t("checkout.priceChanged", { total: formatMoney(Number(result.details?.total ?? total)) }), { duration: 8000 });
      } else if (result.code === "OUT_OF_STOCK" || result.code === "VARIANT_UNAVAILABLE") {
        toast.error(t("checkout.problems"), { duration: 8000 });
      } else if (result.code === "VALIDATION" && result.fieldErrors) {
        setErrors(result.fieldErrors);
        toast.error(t("errors.VALIDATION"));
      } else {
        toast.error(t(`errors.${result.code}`));
      }
      startRefresh(() => router.refresh());
    });
  };

  const fieldError = (key: string) => (errors[key] ? t(`errors.${errors[key] === "invalid" ? "invalid" : errors[key]}`) : undefined);

  const summary = (
    <div className={cn("rounded-xl border border-line bg-white p-5 sm:p-6", refreshing && "opacity-70")}>
      <h2 className="heading-section text-[26px]">{t("checkout.yourOrder")}</h2>
      <div className="mt-2 divide-y divide-line">
        {cart.lines.map((line) => (
          <CartLine key={line.variantId} line={line} compact onChanged={() => startRefresh(() => router.refresh())} />
        ))}
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <p className="mb-2 text-sm font-bold">{t("cart.promo")}</p>
        <PromoForm promo={cart.promo} error={cart.promoError} />
      </div>
      <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-600">{t("cart.items", { count: cart.itemsCount })}</dt>
          <dd className="font-semibold">{formatMoney(cart.itemsRegular)}</dd>
        </div>
        {cart.itemsDiscount + (cart.promo?.discount ?? 0) > 0 && (
          <div className="flex justify-between">
            <dt className="text-ink-600">{t("cart.discount")}</dt>
            <dd className="font-semibold text-powder-700">−{formatMoney(cart.itemsDiscount + (cart.promo?.discount ?? 0))}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-ink-600">{t("cart.delivery")}</dt>
          <dd className="font-semibold">{deliveryPrice > 0 ? formatMoney(deliveryPrice) : t("checkout.free")}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-base font-semibold">{t("cart.total")}</span>
        <span className="text-[26px] font-bold tracking-tight">{formatMoney(total)}</span>
      </div>
      {delivery?.freeFrom && cart.itemsTotal < delivery.freeFrom && (
        <p className="mt-3 rounded-md bg-sage-50 px-3 py-2 text-xs font-medium text-sage-800">
          {t("cart.freeDeliveryLeft", { amount: formatMoney(delivery.freeFrom - cart.itemsTotal) })}
        </p>
      )}
      <Button type="submit" form="checkout-form" block size="lg" className="mt-5 hidden lg:flex" loading={pending} disabled={cart.hasProblems}>
        {t("checkout.submit")}
      </Button>
    </div>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_400px] lg:gap-8">
      {/* состав заказа на телефоне — свёрнут */}
      <div className="lg:hidden">
        <button type="button" onClick={() => setSummaryOpen((o) => !o)} className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 py-3.5 text-sm font-semibold" aria-expanded={summaryOpen}>
          <span className="flex items-center gap-2">
            <PackageCheck className="size-5 text-sage-700" />
            {summaryOpen ? t("checkout.hideSummary") : t("checkout.showSummary")}
          </span>
          <span className="flex items-center gap-2">
            {formatMoney(total)}
            <ChevronDown className={cn("size-4 transition-transform", summaryOpen && "rotate-180")} />
          </span>
        </button>
        {summaryOpen && <div className="mt-3">{summary}</div>}
      </div>

      <form id="checkout-form" onSubmit={submit} noValidate className="space-y-5">
        {!isLoggedIn && (
          <p className="rounded-lg bg-beige-50 px-4 py-3 text-sm text-ink-600">
            {t.rich("checkout.loginHint", {
              link: (chunks) => (
                <Link href="/account/login?next=/checkout" className="font-semibold text-sage-700 underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}

        <Step index={1} title={t("checkout.contacts")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("checkout.name")} required error={fieldError("name")} className="sm:col-span-2">
              <Input value={form.name} onChange={set("name")} placeholder={t("checkout.namePlaceholder")} autoComplete="name" invalid={Boolean(errors.name)} />
            </Field>
            <Field label={t("checkout.phone")} required error={fieldError("phone")}>
              <Input
                value={form.phone}
                onChange={(e) => {
                  setForm((f) => ({ ...f, phone: formatPhoneInput(e.target.value) }));
                  setErrors((prev) => ({ ...prev, phone: "" }));
                }}
                onFocus={() => !form.phone && setForm((f) => ({ ...f, phone: "+7 " }))}
                placeholder="+7 777 123 45 67"
                inputMode="tel"
                autoComplete="tel"
                invalid={Boolean(errors.phone)}
              />
            </Field>
            <Field label={`${t("checkout.email")} (${t("common.optional")})`} hint={t("checkout.emailHint")} error={fieldError("email")}>
              <Input type="email" value={form.email} onChange={set("email")} placeholder="example@mail.kz" autoComplete="email" inputMode="email" invalid={Boolean(errors.email)} />
            </Field>
          </div>
        </Step>

        <Step index={2} title={t("checkout.address")}>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t("checkout.deliveryMethod")}>
            {deliveries.map((d) => {
              const Icon = DELIVERY_ICONS[d.kind];
              const price = d.freeFrom !== null && cart.itemsTotal >= d.freeFrom ? 0 : d.price;
              const active = d.id === delivery?.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => chooseDelivery(d.id)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-lg border p-3.5 text-left transition-colors",
                    active ? "border-sage-700 bg-sage-50 ring-1 ring-sage-700" : "border-line-strong bg-white hover:border-sage-400",
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <Icon className={cn("size-5", active ? "text-sage-700" : "text-ink-500")} />
                    {active && <Check className="size-4 text-sage-700" />}
                  </span>
                  <span className="text-sm leading-tight font-semibold">{d.name}</span>
                  <span className="text-xs text-ink-500">
                    {d.eta && `${d.eta} · `}
                    <span className="font-semibold text-graphite">{price > 0 ? formatMoney(price) : t("checkout.free")}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {delivery?.description && <p className="mt-3 text-xs text-ink-500">{delivery.description}</p>}

          {delivery?.kind === "PICKUP" ? (
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-beige-50 p-4">
              <Store className="mt-0.5 size-5 shrink-0 text-sage-700" />
              <div className="text-sm">
                <p className="font-semibold">{t("checkout.pickupAt")}</p>
                <p className="mt-0.5 text-ink-600">{delivery.address}</p>
                {hours && <p className="mt-0.5 text-xs text-ink-500">{hours}</p>}
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-6">
              {delivery?.kind === "LOCAL_COURIER" && delivery.address && (
                <p className="flex items-center gap-2 text-sm text-ink-600 sm:col-span-6">
                  <MapPin className="size-4 text-sage-700" />
                  {t("checkout.courierCity", { city: delivery.address })}
                </p>
              )}
              {delivery?.kind === "KAZAKHSTAN" && (
                <>
                  <Field label={t("checkout.region")} className="sm:col-span-3">
                    <Input value={form.region} onChange={set("region")} autoComplete="address-level1" />
                  </Field>
                  <Field label={t("checkout.city")} required error={fieldError("city")} className="sm:col-span-3">
                    <Input value={form.city} onChange={set("city")} autoComplete="address-level2" invalid={Boolean(errors.city)} />
                  </Field>
                </>
              )}
              <Field label={t("checkout.street")} required error={fieldError("street")} className="sm:col-span-6">
                <Input value={form.street} onChange={set("street")} autoComplete="address-line1" invalid={Boolean(errors.street)} />
              </Field>
              <Field label={t("checkout.house")} required error={fieldError("house")} className="sm:col-span-2">
                <Input value={form.house} onChange={set("house")} invalid={Boolean(errors.house)} />
              </Field>
              <Field label={t("checkout.apartment")} className="sm:col-span-2">
                <Input value={form.apartment} onChange={set("apartment")} autoComplete="address-line2" />
              </Field>
              {delivery?.kind === "KAZAKHSTAN" && (
                <Field label={t("checkout.postalCode")} className="sm:col-span-2">
                  <Input value={form.postalCode} onChange={set("postalCode")} inputMode="numeric" autoComplete="postal-code" />
                </Field>
              )}
            </div>
          )}

          <Field label={t("checkout.comment")} className="mt-4">
            <Textarea value={form.comment} onChange={set("comment")} rows={3} placeholder={t("checkout.commentPlaceholder")} />
          </Field>
        </Step>

        <Step index={3} title={t("checkout.payment")}>
          <div className="space-y-3" role="radiogroup" aria-label={t("checkout.payment")}>
            {allowedPayments.map((p) => {
              const active = p.id === payment?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPaymentId(p.id)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors",
                    active ? "border-sage-700 bg-sage-50 ring-1 ring-sage-700" : "border-line-strong bg-white hover:border-sage-400",
                  )}
                >
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", active ? "border-sage-700" : "border-line-strong")}>
                    {active && <span className="size-2.5 rounded-full bg-sage-700" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{p.name}</span>
                    {p.description && <span className="mt-0.5 block text-xs text-ink-500">{p.description}</span>}
                  </span>
                  {p.kind === "KASPI" ? <KaspiBadge label="Kaspi" /> : <Wallet className="size-6 text-ink-400" />}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-lg bg-powder-50 p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-powder-700" />
            <div className="text-sm">
              <p className="font-semibold text-powder-800">{t("checkout.secureTitle")}</p>
              <p className="text-xs text-ink-600">{t("checkout.secureText")}</p>
            </div>
          </div>

          <div className="mt-5">
            <Checkbox
              checked={form.consent}
              onChange={(e) => {
                setForm((f) => ({ ...f, consent: e.target.checked }));
                setErrors((prev) => ({ ...prev, consent: "" }));
              }}
              aria-invalid={Boolean(errors.consent) || undefined}
              label={
                <span className="text-[13px] leading-relaxed">
                  {t.rich("checkout.consent", {
                    offer: (chunks) => (
                      <Link href="/offer" target="_blank" className="text-sage-700 underline underline-offset-2">
                        {chunks}
                      </Link>
                    ),
                    privacy: (chunks) => (
                      <Link href="/privacy" target="_blank" className="text-sage-700 underline underline-offset-2">
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
              }
            />
            {errors.consent && <p className="mt-1.5 text-xs font-medium text-powder-700">{t("errors.consent")}</p>}
          </div>
        </Step>

        <Link href="/cart" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 hover:text-sage-700">
          <ArrowLeft className="size-4" />
          {t("checkout.backToCart")}
        </Link>
      </form>

      <aside className="hidden space-y-4 lg:sticky lg:top-[150px] lg:block">
        {summary}
        <div className="rounded-xl border border-line bg-white p-5">
          <p className="mb-3 flex items-center gap-2 font-semibold">
            <LockKeyhole className="size-4 text-sage-700" />
            {t("checkout.guarantees")}
          </p>
          <ul className="space-y-2 text-sm text-ink-600">
            {[t("checkout.guarantee1"), t("checkout.guarantee2"), t("checkout.guarantee3")].map((g) => (
              <li key={g} className="flex items-center gap-2">
                <Check className="size-4 text-sage-600" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* кнопка подтверждения на телефоне */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <Button type="submit" form="checkout-form" block size="lg" loading={pending} disabled={cart.hasProblems}>
          {t("checkout.submitMobile", { total: formatMoney(total) })}
        </Button>
      </div>
    </div>
  );
}
