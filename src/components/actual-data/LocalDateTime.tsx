'use client';
import { useSyncExternalStore } from 'react';

interface Props {
  iso: string;
  kind?: 'datetime' | 'time';
}

const emptySubscribe = () => () => {};

/**
 * Client-only date formatter. On the server, renders an ISO-like fallback.
 * On the client (after hydration), renders the user's locale-formatted string.
 * Uses useSyncExternalStore instead of useEffect+setState so React Compiler
 * lint rules (set-state-in-effect) don't trigger.
 */
export default function LocalDateTime({ iso, kind = 'datetime' }: Props) {
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!isClient) {
    const fallback = iso.slice(0, kind === 'time' ? undefined : 16).replace('T', ' ');
    return <span suppressHydrationWarning>{fallback}</span>;
  }

  const d = new Date(iso);
  const formatted = kind === 'time' ? d.toLocaleTimeString() : d.toLocaleString();
  return <span suppressHydrationWarning>{formatted}</span>;
}
