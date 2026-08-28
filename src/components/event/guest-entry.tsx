'use client';
import { useRef, useState } from 'react';
import { AtSign, Phone, Plus, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { classifyContact, parseContacts, toContact, type Contact } from '@/lib/contacts';
import { cn } from '@/lib/utils';

/**
 * Adding guests, one person per row.
 *
 * This replaces a single textarea that took a pasted blob, and it replaces it because that
 * box could not do the most ordinary thing anybody wants: **put a name to a phone number.**
 * The only syntax that attached a name was `Priya <priya@example.com>` — angle brackets,
 * undocumented, and unavailable to anyone typing a number. Type `Priya, 4155550123` and
 * "Priya" was silently discarded as a stray word, so the host ended up with a list of bare
 * digits and no idea who was who.
 *
 * A name is not decoration here. It is what the host reads back when they are chasing four
 * people who have not replied, and it is what the guest's own invitation greets them with.
 *
 * Pasting still works and is still the fast path — drop a list into any contact field and it
 * expands into rows rather than landing in one — but it is now the shortcut rather than the
 * only door.
 */

interface Row {
  /** Stable across re-renders so React does not reuse an input between two people. */
  key: string;
  name: string;
  contact: string;
}

function blankRow(): Row {
  return { key: crypto.randomUUID(), name: '', contact: '' };
}

export function GuestEntry({
  busy,
  onAdd,
}: {
  busy: boolean;
  /** Resolves true when the guests were accepted, which is when the rows are cleared. */
  onAdd: (guests: Contact[]) => Promise<boolean>;
}) {
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const container = useRef<HTMLDivElement>(null);

  const ready = rows
    .map((row) => toContact(row.contact, row.name))
    .filter((contact): contact is Contact => contact !== null);

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const row = blankRow();
    setRows((current) => [...current, row]);
    // Focus follows the new row, because the alternative is reaching for the mouse between
    // every guest — and a host is entering fifteen of these in a sitting.
    window.requestAnimationFrame(() => {
      container.current?.querySelector<HTMLInputElement>(`#guest-name-${row.key}`)?.focus();
    });
  }

  function removeRow(key: string) {
    setRows((current) => {
      const left = current.filter((row) => row.key !== key);
      return left.length > 0 ? left : [blankRow()];
    });
  }

  /**
   * A paste carrying several people fills several rows.
   *
   * Only when there is genuinely more than one: pasting a single address into a field should
   * behave exactly like pasting a single address into a field, not restructure the form.
   */
  function onPaste(key: string, text: string): boolean {
    const found = parseContacts(text);
    if (found.length < 2) return false;

    setRows((current) => {
      const filled: Row[] = found.map((contact) => ({
        key: crypto.randomUUID(),
        name: contact.name,
        contact: contact.email ?? contact.phone ?? '',
      }));
      // The row that was pasted into is replaced; anything already typed elsewhere stays.
      const target = current.findIndex((row) => row.key === key);
      const before = current
        .slice(0, target)
        .filter((row) => row.contact.trim() || row.name.trim());
      const after = current
        .slice(target + 1)
        .filter((row) => row.contact.trim() || row.name.trim());
      return [...before, ...filled, ...after, blankRow()];
    });
    return true;
  }

  async function submit() {
    if (ready.length === 0) return;
    const accepted = await onAdd(ready);
    if (accepted) setRows([blankRow()]);
  }

  return (
    // A landmark rather than a plain div: with a name it becomes a region, which is what
    // lets someone on a screen reader jump to "add your guests" instead of arrowing through
    // however many people are already on the list.
    <section aria-label="Add your guests" className="card p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <UserPlus className="size-4" aria-hidden />
        Add your guests
      </h3>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        A name and a way to reach them — a phone number or an email address. Pasting a list into the
        second box fills the rest in for you.
      </p>

      <div ref={container} className="mt-4 space-y-2">
        {rows.map((row, index) => (
          <GuestRow
            key={row.key}
            row={row}
            first={index === 0}
            removable={rows.length > 1 || row.name !== '' || row.contact !== ''}
            onChange={(patch) => update(row.key, patch)}
            onPaste={(text) => onPaste(row.key, text)}
            onEnter={addRow}
            onRemove={() => removeRow(row.key)}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" loading={busy} disabled={ready.length === 0} onClick={submit}>
          <UserPlus className="size-4" aria-hidden />
          Add {ready.length > 0 ? ready.length : ''}
        </Button>
        <Button variant="ghost" size="sm" onClick={addRow}>
          <Plus className="size-4" aria-hidden />
          Another
        </Button>
      </div>
    </section>
  );
}

/**
 * One person.
 *
 * The contact field says what it has understood — an address, a number, or nothing yet —
 * because "why is the Add button still greyed out" is the only question this form can
 * provoke, and a mistyped address should answer it before the host presses anything.
 */
function GuestRow({
  row,
  first,
  removable,
  onChange,
  onPaste,
  onEnter,
  onRemove,
}: {
  row: Row;
  first: boolean;
  removable: boolean;
  onChange: (patch: Partial<Row>) => void;
  onPaste: (text: string) => boolean;
  onEnter: () => void;
  onRemove: () => void;
}) {
  const kind = classifyContact(row.contact);
  const unusable = row.contact.trim().length > 0 && kind === 'unknown';

  const field =
    'w-full rounded-xl border bg-[var(--surface-raised)] px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none';

  return (
    <div className="flex items-start gap-2">
      <div className="grid flex-1 gap-2 sm:grid-cols-2">
        <div>
          {first && (
            <label
              htmlFor={`guest-name-${row.key}`}
              className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
            >
              Name
            </label>
          )}
          <input
            id={`guest-name-${row.key}`}
            value={row.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Priya Sharma"
            autoComplete="off"
            aria-label={first ? undefined : 'Name'}
            className={cn(field, 'border-[var(--border-subtle)] focus:border-[var(--accent)]')}
          />
        </div>

        <div>
          {first && (
            <label
              htmlFor={`guest-contact-${row.key}`}
              className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
            >
              Phone or email
            </label>
          )}
          <div className="relative">
            <input
              id={`guest-contact-${row.key}`}
              value={row.contact}
              onChange={(event) => onChange({ contact: event.target.value })}
              onPaste={(event) => {
                const text = event.clipboardData.getData('text');
                // Only intercept a paste that is genuinely a list. Anything else keeps the
                // browser's own behaviour, including replacing a selection.
                if (onPaste(text)) event.preventDefault();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onEnter();
                }
              }}
              placeholder="+1 415 555 0123"
              autoComplete="off"
              inputMode="email"
              aria-label={first ? undefined : 'Phone or email'}
              aria-invalid={unusable || undefined}
              className={cn(
                field,
                'pr-9',
                unusable
                  ? 'border-[var(--danger)]'
                  : 'border-[var(--border-subtle)] focus:border-[var(--accent)]',
              )}
            />
            {kind !== 'unknown' && (
              <span
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--accent)]"
                aria-hidden
              >
                {kind === 'email' ? (
                  <AtSign className="size-3.5" />
                ) : (
                  <Phone className="size-3.5" />
                )}
              </span>
            )}
          </div>
          {unusable && (
            <p className="mt-1 text-xs text-[var(--danger)]">
              That is not an address or a number we could reach.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove this guest"
        disabled={!removable}
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors',
          first && 'mt-6',
          removable
            ? 'hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]'
            : 'cursor-default opacity-0',
        )}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
