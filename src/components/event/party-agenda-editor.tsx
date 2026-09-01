'use client';
import { useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AgendaItem } from '@/types/domain';

interface PartyAgendaEditorProps {
  agenda: AgendaItem[];
  onChange: (nextAgenda: AgendaItem[]) => void;
}

const DEFAULT_BIRTHDAY_SCHEDULE: Array<Omit<AgendaItem, 'id'>> = [
  {
    time: '2:00 PM',
    title: 'Arrival & Welcome Play',
    emoji: '🎈',
    description: 'Fun party games & bouncy castle',
  },
  {
    time: '3:00 PM',
    title: 'Snacks & Pizza Time',
    emoji: '🍕',
    description: 'Kid-friendly food and refreshments',
  },
  {
    time: '4:15 PM',
    title: 'Cake Cutting & Birthday Song',
    emoji: '🎂',
    description: 'Singing Happy Birthday and blowing out candles!',
  },
  {
    time: '5:00 PM',
    title: 'Piñata Smash & Goodie Bags',
    emoji: '🪅',
    description: 'Party favor distribution and sweet treats',
  },
];

export function PartyAgendaEditor({ agenda, onChange }: PartyAgendaEditorProps) {
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('🎈');

  function handleAdd() {
    if (!time.trim() || !title.trim()) return;
    const newItem: AgendaItem = {
      id: `agenda_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time: time.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      emoji: emoji.trim() || '✨',
    };
    onChange([...agenda, newItem]);
    setTime('');
    setTitle('');
    setDescription('');
  }

  function handleRemove(id: string) {
    onChange(agenda.filter((item) => item.id !== id));
  }

  function handleLoadStarters() {
    const starterItems: AgendaItem[] = DEFAULT_BIRTHDAY_SCHEDULE.map((s, i) => ({
      ...s,
      id: `agenda_starter_${i}_${Date.now()}`,
    }));
    onChange(starterItems);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-[var(--text-primary)]">Party Agenda & Timeline</h4>
          <p className="text-xs text-[var(--text-secondary)]">
            Help parents and guests know when cake cutting, meals, or shows take place.
          </p>
        </div>

        {agenda.length === 0 && (
          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={handleLoadStarters}
            className="shrink-0 rounded-full"
          >
            <Sparkles className="size-3.5" />
            Load Birthday Schedule
          </Button>
        )}
      </div>

      {/* Current Agenda Items List */}
      {agenda.length > 0 && (
        <ul className="space-y-2">
          {agenda.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--surface-raised)] text-base">
                  {item.emoji || '✨'}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--accent)]">{item.time}</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {item.title}
                    </span>
                  </div>
                  {item.description && (
                    <p className="line-clamp-1 text-xs text-[var(--text-muted)]">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                className="flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add New Item Form */}
      <div className="grid grid-cols-1 gap-2 border-t border-[var(--border-subtle)] pt-2 sm:grid-cols-4">
        <div>
          <label className="text-[0.7rem] font-semibold text-[var(--text-muted)]">Time</label>
          <input
            type="text"
            placeholder="e.g. 4:15 PM"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[0.7rem] font-semibold text-[var(--text-muted)]">
            Activity Title
          </label>
          <input
            type="text"
            placeholder="e.g. Cake Cutting"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[0.7rem] font-semibold text-[var(--text-muted)]">Emoji</label>
          <select
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="mt-1 h-9 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="🎈">🎈 Balloon</option>
            <option value="🎂">🎂 Cake</option>
            <option value="🍕">🍕 Pizza</option>
            <option value="🪅">🪅 Piñata</option>
            <option value="✨">✨ Magic</option>
            <option value="🎶">🎶 Music</option>
            <option value="🎁">🎁 Gifts</option>
            <option value="🥳">🥳 Party</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="soft"
            size="sm"
            disabled={!time.trim() || !title.trim()}
            onClick={handleAdd}
            className="h-9 w-full rounded-xl"
          >
            <Plus className="size-3.5" />
            Add Item
          </Button>
        </div>
      </div>
    </div>
  );
}
