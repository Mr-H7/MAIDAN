import type { InputHTMLAttributes } from "react";
type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};
export function Field({ label, error, id, ...props }: Props) {
  const fieldId = id || label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label className="field" htmlFor={fieldId}>
      <span>{label}</span>
      <input id={fieldId} {...props} />
      {error && <small role="alert">{error}</small>}
    </label>
  );
}
