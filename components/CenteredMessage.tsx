import type { ReactNode } from "react";
import type { SessionStatus } from "@/lib/client/use-session-state";
import { Credit } from "./Credit";
import { Logo } from "./Logo";
import { SplashScreen } from "./SplashScreen";

/** A full-page message: bad codes, ended sessions, loading and connection trouble. */
export function CenteredMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-md">
        <span className="inline-flex"><Logo label={null} mark="h-12 w-12" /></span>
        <h1 className="mt-5 font-display text-[2rem] font-extrabold leading-tight tracking-tight">{title}</h1>
        {children ? <p className="mt-2 text-base text-ink-muted">{children}</p> : null}
        <Credit className="mt-8" />
      </div>
    </div>
  );
}

/** What every screen shows until the first session state arrives: the splash, or why it is taking so long. */
export function SessionLoadingMessage({ status }: { status: SessionStatus }) {
  if (status !== "error") return <SplashScreen />;
  return <CenteredMessage title="Can't reach the server">Check your connection. This page will keep retrying.</CenteredMessage>;
}
