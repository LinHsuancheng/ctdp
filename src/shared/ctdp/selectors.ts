import type { CtdpState, Precedent } from "./types";

const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** The precedent that already allows exactly this behavior, if any. */
export function findPrecedent(precedents: Precedent[], behavior: string): Precedent | undefined {
  const key = normalize(behavior);
  return key ? precedents.find((p) => normalize(p.behavior) === key) : undefined;
}

/** Precedents that look related to what the user is typing. */
export function relatedPrecedents(precedents: Precedent[], behavior: string): Precedent[] {
  const key = normalize(behavior);
  if (!key) return [];
  return precedents.filter((p) => {
    const b = normalize(p.behavior);
    return b.includes(key) || key.includes(b);
  });
}

export function phaseLabel(state: CtdpState): string {
  switch (state.phase.kind) {
    case "idle":
      return "空闲";
    case "reserved":
      return "已预约";
    case "focusing":
      return "专注中";
  }
}

/** Milliseconds until the current phase's deadline, or null when idle. */
export function remainingMs(state: CtdpState, now: number): number | null {
  const { phase } = state;
  if (phase.kind === "reserved") return phase.deadline - now;
  if (phase.kind === "focusing") return phase.endsAt - now;
  return null;
}

/** Fraction of the current phase already elapsed, 0..1. */
export function progress(state: CtdpState, now: number): number {
  const { phase } = state;
  const [start, end] =
    phase.kind === "reserved"
      ? [phase.reservedAt, phase.deadline]
      : phase.kind === "focusing"
        ? [phase.startedAt, phase.endsAt]
        : [0, 0];
  if (end <= start) return 0;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}
