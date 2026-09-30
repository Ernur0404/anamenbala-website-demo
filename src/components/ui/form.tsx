"use client";

import { cloneElement, forwardRef, isValidElement, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-line-strong bg-white px-3.5 text-[14px] text-graphite placeholder:text-ink-400 transition-[border-color,box-shadow] outline-none focus:border-sage-500 focus:ring-3 focus:ring-sage-500/15 disabled:bg-cream-200 disabled:text-ink-500 aria-[invalid=true]:border-powder-600 aria-[invalid=true]:ring-powder-300/40";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(fieldBase, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea(
  { className, invalid, rows = 4, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cn(fieldBase, "min-h-24 resize-y py-2.5 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; wrapperClassName?: string }>(function Select(
  { className, wrapperClassName, invalid, children, ...props },
  ref,
) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select ref={ref} aria-invalid={invalid || undefined} className={cn(fieldBase, "h-11 cursor-pointer appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
    </div>
  );
});

export function Label({ className, children, required, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-[13px] font-medium text-ink-700", className)} {...props}>
      {children}
      {required && <span className="ml-0.5 text-powder-700">*</span>}
    </label>
  );
}

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-powder-700">
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-ink-500">{children}</p>;
}

/** Поле формы: подпись связана с элементом (id проставляется автоматически) + подсказка/ошибка */
export function Field({
  label,
  required,
  error,
  hint,
  className,
  children,
  htmlFor,
}: {
  label?: ReactNode;
  required?: boolean;
  error?: ReactNode;
  hint?: ReactNode;
  className?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const autoId = useId();
  const child = isValidElement<{ id?: string; "aria-describedby"?: string }>(children) ? children : null;
  const id = htmlFor ?? child?.props.id ?? autoId;
  const describedBy = error || hint ? `${id}-desc` : undefined;
  const control = child ? cloneElement(child, { id, "aria-describedby": describedBy }) : children;
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      )}
      {control}
      {error ? <FieldError id={describedBy}>{error}</FieldError> : hint ? <p id={describedBy} className="mt-1.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; description?: ReactNode }>(function Checkbox(
  { className, label, description, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const box = (
    <input
      ref={ref}
      id={inputId}
      type="checkbox"
      className={cn(
        "peer size-[18px] shrink-0 cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-white transition-colors checked:border-sage-700 checked:bg-sage-700 focus-visible:ring-3 focus-visible:ring-sage-500/20 disabled:cursor-not-allowed disabled:opacity-50",
        "bg-center bg-no-repeat checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 8.5l3 3 6-7'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    />
  );
  if (!label) return box;
  return (
    <label htmlFor={inputId} className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-700 select-none">
      <span className="mt-[1px] flex">{box}</span>
      <span className="min-w-0 flex-1">
        {label}
        {description && <span className="mt-0.5 block text-xs text-ink-500">{description}</span>}
      </span>
    </label>
  );
});

export const Radio = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Radio({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="radio"
      className={cn(
        "size-[18px] shrink-0 cursor-pointer appearance-none rounded-full border border-line-strong bg-white transition-all checked:border-[5px] checked:border-sage-700 focus-visible:ring-3 focus-visible:ring-sage-500/20",
        className,
      )}
      {...props}
    />
  );
});
