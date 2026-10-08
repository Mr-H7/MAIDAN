import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
  arrow?: boolean;
};
// Adapted from Uiverse Galaxy 0x-Sarthak hungry-penguin-30: pill, overlay, arrow motion.
export function ActionButton({
  children,
  variant = "primary",
  arrow = false,
  className = "",
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={`ui-action ui-action--${variant} ${className}`}
    >
      <span className="ui-action__fill" aria-hidden="true" />
      <span className="ui-action__content">
        {children}
        {arrow && (
          <ArrowRight
            size={17}
            aria-hidden="true"
            className="ui-action__arrow"
          />
        )}
      </span>
    </button>
  );
}
