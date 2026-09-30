import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,color,border-color,box-shadow,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-sage-700 text-white shadow-[0_1px_0_rgb(0_0_0/0.04)] hover:bg-sage-800 active:bg-sage-900",
        powder: "bg-powder-300 text-powder-800 hover:bg-powder-400/80 active:bg-powder-400",
        secondary: "border border-line-strong bg-white text-graphite hover:border-sage-400 hover:bg-sage-50",
        soft: "bg-sage-100 text-sage-800 hover:bg-sage-200",
        beige: "bg-beige-100 text-graphite hover:bg-beige-200",
        ghost: "text-graphite hover:bg-beige-100",
        link: "px-0 text-sage-700 underline-offset-4 hover:underline",
        danger: "bg-danger text-white hover:bg-[#9c3b3b]",
        dangerSoft: "bg-powder-100 text-powder-800 hover:bg-powder-200",
      },
      size: {
        xs: "h-8 rounded-sm px-3 text-xs",
        sm: "h-9 rounded-md px-3.5 text-[13px]",
        md: "h-11 rounded-md px-5 text-sm",
        lg: "h-[52px] rounded-lg px-6 text-[15px]",
        icon: "size-10 rounded-md",
        iconSm: "size-8 rounded-sm",
      },
      block: { true: "w-full" },
    },
    compoundVariants: [{ variant: "link", className: "h-auto" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild, loading, disabled, children, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <LoaderCircle className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
});
