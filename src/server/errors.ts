/** Коды доменных ошибок — переводятся на витрине и в админке */
export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "OUT_OF_STOCK"
  | "VARIANT_UNAVAILABLE"
  | "CART_EMPTY"
  | "PRICE_CHANGED"
  | "DELIVERY_UNAVAILABLE"
  | "PAYMENT_UNAVAILABLE"
  | "PROMO_NOT_FOUND"
  | "PROMO_EXPIRED"
  | "PROMO_MIN_AMOUNT"
  | "PROMO_LIMIT"
  | "PROMO_NOT_APPLICABLE"
  | "INVALID_TRANSITION"
  | "ORDER_LOCKED"
  | "CONFLICT"
  | "INTERNAL";

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "DomainError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; error: string; details?: Record<string, unknown>; fieldErrors?: Record<string, string> };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, error: string, extra?: { details?: Record<string, unknown>; fieldErrors?: Record<string, string> }): ActionResult<never> {
  return { ok: false, code, error, ...extra };
}
