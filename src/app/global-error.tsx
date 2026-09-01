'use client';

/**
 * Last-resort error boundary. It replaces the root layout entirely when it renders, so it
 * ships its own <html>/<body> and deliberately depends on nothing — no providers, no
 * config, no context — because whatever failed may be exactly that.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          textAlign: 'center',
          background: '#fdf8f4',
          color: '#2a2320',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: '#6b5f59', maxWidth: '28rem' }}>
          That is on us. Try again, and if it keeps happening the event may have ended.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: 'none',
            borderRadius: '999px',
            padding: '0.7rem 1.6rem',
            fontSize: '0.95rem',
            fontWeight: 500,
            color: '#fff',
            background: '#c65f47',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
