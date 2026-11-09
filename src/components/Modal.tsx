"use client";

import { ActionLabel } from "@/components/ActionLabel";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { useAppearance } from "./AppearanceProvider";

interface ModalProps {
  open: boolean;
  /** Already translated. */
  title: string;
  onClose: () => void;
  /** Wider panel for forms with many fields. */
  size?: "md" | "lg" | "xl";
  children: ReactNode;
  /** Sticky bottom bar; when it is a form modal it holds the cancel and submit buttons. */
  footer?: ReactNode;
  /** When set, header + body + footer are one `<form>`: Enter in a field and the footer's submit button both call it. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
}

const WIDTHS = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

/**
 * A dialog with a fixed header (title and close button), a body that scrolls
 * when it is taller than the screen, and a fixed footer. Escape and a click on
 * the backdrop close it, the page behind does not scroll while it is open.
 */
export function Modal({ open, title, onClose, size = "lg", children, footer, onSubmit }: ModalProps) {
  const { t } = useAppearance();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);

    // First field of the body, else the panel itself.
    const first = panelRef.current?.querySelector<HTMLElement>("[data-modal-body] :is(input, select, textarea):not([type=hidden]):not([disabled])");
    (first ?? panelRef.current)?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const content = (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <h2 id={titleId} className="font-display text-lg font-semibold text-ink">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("modal.close")}
          title={t("modal.close")}
          className="rounded-sm p-1 text-ink-soft transition-colors hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <div data-modal-body className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {children}
      </div>

      {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-raised px-5 py-3">{footer}</footer> : null}
    </>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex max-h-full w-full flex-col overflow-hidden rounded-sm bg-surface shadow-card-hover border-b-4 border-b-gold ${WIDTHS[size]}`}
      >
        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {content}
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">{content}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface FormModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Throw to keep the dialog open (show the message with `error`); return to close it is up to the caller. */
  onSubmit: () => Promise<void> | void;
  /** Label of the validation button, already translated. */
  submitLabel: string;
  submitting?: boolean;
  /** Disables the validation button (e.g. a required field is empty). */
  disabled?: boolean;
  error?: string | null;
  size?: ModalProps["size"];
  children: ReactNode;
}

/** A `Modal` whose footer holds Cancel and the validation button; the body is the form's fields. */
export function FormModal({ open, title, onClose, onSubmit, submitLabel, submitting = false, disabled = false, error, size, children }: FormModalProps) {
  const { t } = useAppearance();

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size={size}
      onSubmit={(event) => {
        event.preventDefault();
        if (!submitting && !disabled) void onSubmit();
      }}
      footer={
        <>
          {error ? (
            <p role="alert" className="mr-auto text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="button" variant="secondary" onClick={onClose}>
            <ActionLabel text={t("modal.cancel")} />
          </Button>
          <Button type="submit" disabled={submitting || disabled}>
            <ActionLabel text={submitLabel} />
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
