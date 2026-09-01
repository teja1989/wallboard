'use client';
import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';

/**
 * Reading the message before sending it to everybody.
 *
 * There was no way to. `renderEmail` builds the HTML that lands in forty inboxes and a host
 * had no means of looking at it first — the product asked people to mail something they had
 * never seen, to everyone they know.
 *
 * Fetched on demand rather than with the panel: nobody opens this every time, and it costs a
 * render and a join-code read.
 */
export function EmailPreview({ eventId }: { eventId: string }) {
  const { notify } = useToast();
  const [html, setHtml] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);

  async function show() {
    if (html) return setHtml(null);
    setLoading(true);
    try {
      const result = await api.get<{ html: string; subject: string }>(
        `/api/events/${eventId}/email-preview?kind=invitation`,
      );
      setHtml(result.html);
      setSubject(result.subject);
    } catch (caught) {
      notify(errorMessage(caught, 'Could not build the preview.'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button variant="ghost" size="sm" loading={loading} onClick={show}>
        <Mail className="size-4" aria-hidden />
        {html ? 'Hide the email' : 'See what guests receive'}
      </Button>

      {html && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-[var(--text-muted)]">
            Subject: <span className="text-[var(--text-secondary)]">{subject}</span>
          </p>
          {/*
            `sandbox` with no `allow-same-origin` and no `allow-scripts`: the document gets an
            opaque origin and cannot run anything or reach this page. The HTML is ours and its
            inputs are escaped, but a preview surface is the wrong place to be relying on that
            — the sandbox means it would not matter if the escaping were ever wrong.
          */}
          <iframe
            title="The invitation email"
            srcDoc={html}
            sandbox=""
            loading="lazy"
            className="h-[28rem] w-full rounded-2xl border border-[var(--border-subtle)] bg-white"
          />
          {/*
            Said plainly rather than left to be assumed. This renders the message; it does not
            prove where it lands. Spam placement and how a given client mangles the layout are
            real risks that no in-page preview can speak to, and a host who believes otherwise
            has been misled by us rather than by their mail provider.
          */}
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            This is the message as we build it. How it looks in any particular mail app — and
            whether it lands in the inbox or the spam folder — is up to the guest&rsquo;s provider.
          </p>
        </div>
      )}
    </div>
  );
}
