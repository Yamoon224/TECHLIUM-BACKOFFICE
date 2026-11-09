"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { Children, Fragment, isValidElement, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { useAppearance } from "./AppearanceProvider";

interface Option {
  value: string;
  label: string;
  disabled: boolean;
}

/** The text of a node: what an `<option>` shows. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

/** The `<option>`s inside `children`, looking through fragments and arrays. */
function optionsOf(children: ReactNode): Option[] {
  const options: Option[] = [];

  const walk = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;
      const element = child as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;
      if (element.type === "option") {
        const label = textOf(element.props.children);
        options.push({ value: String(element.props.value ?? label), label, disabled: Boolean(element.props.disabled) });
      } else if (element.type === Fragment || element.type === "optgroup") {
        walk(element.props.children);
      }
    });
  };
  walk(children);

  return options;
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type SearchSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "defaultValue" | "multiple" | "size"> & {
  value: string | number;
  /** Called like a native select's: handlers read `event.target.value`. */
  onChange?: (event: { target: { value: string }; currentTarget: { value: string } }) => void;
};

/**
 * A drop-in replacement for `<select>` whose list can be searched: it takes the
 * same `<option>` children, `value`, `className` and `onChange(event.target.value)`.
 * The list opens under the field (in a portal, so a scrolling dialog never clips
 * it), a search box filters the options on their text, accents and case ignored,
 * and the arrow keys, Enter and Escape work as in a native list.
 */
export function SearchSelect({ value, onChange, children, className = "", disabled, name, id, required, "aria-label": ariaLabel }: SearchSelectProps) {
  const { tr } = useAppearance();
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ left: number; top: number; width: number; above: boolean } | null>(null);

  const options = useMemo(() => optionsOf(children), [children]);
  const current = options.find((option) => option.value === String(value));
  const shown = useMemo(() => {
    const wanted = fold(query.trim());
    return wanted === "" ? options : options.filter((option) => fold(option.label).includes(wanted));
  }, [options, query]);

  function place() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const above = window.innerHeight - rect.bottom < 280 && rect.top > window.innerHeight - rect.bottom;
    setBox({ left: rect.left, top: above ? rect.top : rect.bottom, width: Math.max(rect.width, 200), above });
  }

  function openList() {
    if (disabled) return;
    place();
    setQuery("");
    setActive(Math.max(0, options.findIndex((option) => option.value === String(value))));
    setOpen(true);
  }

  function choose(option: Option) {
    if (option.disabled) return;
    onChange?.({ target: { value: option.value }, currentTarget: { value: option.value } });
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();

    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      // Closes the list only, not a dialog around it.
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(shown.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (shown[active]) choose(shown[active]);
    }
  }

  return (
    <div className="select-root">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openList();
          }
        }}
        className={`select-trigger flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">{current?.label ?? ""}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
      </button>
      {name ? <input type="hidden" name={name} value={String(value)} required={required} /> : null}

      {open && box
        ? createPortal(
            <div
              ref={panelRef}
              style={{ left: box.left, top: box.top, width: box.width, transform: box.above ? "translateY(-100%)" : undefined }}
              className="fixed z-[70] flex max-h-72 flex-col overflow-hidden rounded-sm border border-line bg-surface text-sm text-ink shadow-lg"
            >
              <div className="relative border-b border-line">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onSearchKey}
                  placeholder={tr("Rechercher…")}
                  aria-label={tr("Rechercher dans la liste")}
                  className="w-full bg-transparent py-2 pl-8 pr-3 text-ink outline-none placeholder:text-ink-soft"
                />
              </div>
              <ul id={listId} role="listbox" className="min-h-0 overflow-y-auto py-1">
                {shown.length === 0 ? (
                  <li className="px-3 py-2 text-ink-soft">{tr("Aucun résultat")}</li>
                ) : (
                  shown.map((option, index) => (
                    <li
                      key={`${option.value}-${index}`}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={option.value === String(value)}
                      aria-disabled={option.disabled || undefined}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(option)}
                      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 ${index === active ? "bg-gold/15" : ""} ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <span className="truncate">{option.label || "-"}</span>
                      {option.value === String(value) ? <Check className="h-4 w-4 shrink-0 text-gold-bright" aria-hidden /> : null}
                    </li>
                  ))
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
