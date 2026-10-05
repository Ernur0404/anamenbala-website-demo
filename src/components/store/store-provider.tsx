"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { addToCartAction, toggleFavoriteAction } from "@/server/actions/store";
import { useRouter } from "@/i18n/navigation";

type StoreState = {
  cartCount: number;
  setCartCount: (count: number) => void;
  /** Непрочитанные уведомления (колокольчик) */
  notificationCount: number;
  setNotificationCount: (count: number) => void;
  favorites: Set<string>;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => Promise<void>;
  addToCart: (variantId: string, quantity?: number, options?: { silent?: boolean }) => Promise<boolean>;
  pending: boolean;
};

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({
  initialCartCount,
  initialFavorites,
  initialNotificationCount = 0,
  children,
}: {
  initialCartCount: number;
  initialFavorites: string[];
  initialNotificationCount?: number;
  children: ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [cartCount, setCartCount] = useState(initialCartCount);
  const [notificationCount, setNotificationCount] = useState(initialNotificationCount);
  // сервер пересчитал (новый заказ, обновление страницы) — показываем свежее число
  const [serverNotificationCount, setServerNotificationCount] = useState(initialNotificationCount);
  if (serverNotificationCount !== initialNotificationCount) {
    setServerNotificationCount(initialNotificationCount);
    setNotificationCount(initialNotificationCount);
  }
  const [favorites, setFavorites] = useState(() => new Set(initialFavorites));
  const [pending, startTransition] = useTransition();

  const toggleFavorite = useCallback(
    async (productId: string) => {
      const wasFavorite = favorites.has(productId);
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(productId);
        else next.add(productId);
        return next;
      });
      const result = await toggleFavoriteAction(productId);
      if (!result.ok) {
        setFavorites((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(productId);
          else next.delete(productId);
          return next;
        });
        toast.error(t(`errors.${result.code}`));
        return;
      }
      toast.success(result.data.favorite ? t("product.favoriteAdded") : t("product.favoriteRemoved"), { duration: 1800 });
    },
    [favorites, t],
  );

  const addToCart = useCallback(
    async (variantId: string, quantity = 1, options?: { silent?: boolean }) => {
      const result = await addToCartAction(variantId, quantity);
      if (!result.ok) {
        toast.error(t(`errors.${result.code}`));
        return false;
      }
      setCartCount(result.data.count);
      if (!options?.silent) {
        toast.success(t("product.added"), {
          action: { label: t("product.goToCart"), onClick: () => router.push("/cart") },
        });
      }
      startTransition(() => router.refresh());
      return true;
    },
    [router, t],
  );

  const value = useMemo<StoreState>(
    () => ({
      cartCount,
      setCartCount,
      notificationCount,
      setNotificationCount,
      favorites,
      isFavorite: (id) => favorites.has(id),
      toggleFavorite,
      addToCart,
      pending,
    }),
    [cartCount, notificationCount, favorites, toggleFavorite, addToCart, pending],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore вне StoreProvider");
  return ctx;
}
