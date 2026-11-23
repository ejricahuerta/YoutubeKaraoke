"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { anonymizeAnalyticsUrl } from "@/lib/domain/analytics";

function withoutSessionCode(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = anonymizeAnalyticsUrl(event.url);
  return url ? { ...event, url } : null;
}

/**
 * Vercel Web Analytics page views, with session codes taken out of every URL (docs/adr/0027).
 * A client component because the root layout cannot pass a function to one.
 */
export function PageAnalytics() {
  return <Analytics beforeSend={withoutSessionCode} />;
}
