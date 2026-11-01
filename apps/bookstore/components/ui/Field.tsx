"use client";

import { useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

export interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** 表单壳层：标签、错误、提示与可访问性关联。 */
export function FieldShell({
  label,
  hint,
  error,
  disabled,
  className,
  children,
}: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className="font-mono text-label tracking-label uppercase text-ink-dim"
      >
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-label text-ink-dim">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-label text-crimson">
          {error}
        </p>
      ) : null}
      {disabled ? <span className="sr-only">禁用</span> : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-md border border-line bg-soft px-3 text-ink placeholder:text-ink-mute " +
  "transition-colors duration-(--duration-fast) focus:border-flower focus:outline-none " +
  "focus:ring-2 focus:ring-flower/20 disabled:cursor-not-allowed disabled:opacity-60";

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}

export default function Field({ label, hint, error, className, disabled, ...rest }: FieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} disabled={disabled} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          {...rest}
          id={id}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL, "h-11", invalid && "border-crimson")}
        />
      )}
    </FieldShell>
  );
}

export interface TextareaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}

export function TextareaField({ label, hint, error, className, disabled, ...rest }: TextareaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} disabled={disabled} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          {...rest}
          id={id}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL, "min-h-28 py-2.5", invalid && "border-crimson")}
        />
      )}
    </FieldShell>
  );
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}

export function SelectField({ label, hint, error, className, disabled, children, ...rest }: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} disabled={disabled} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          {...rest}
          id={id}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL, "h-11", invalid && "border-crimson")}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}
