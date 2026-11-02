import { useEffect, useState } from "react";
import { chainOf, orderedChains, type CtdpState } from "../../../shared/ctdp";
import { ConfirmDialog } from "../components/kit/ConfirmDialog";
import { DimPrompt } from "../components/kit/DimPrompt";
import { useToast } from "../components/kit/useToast";
import { ReservationJudge } from "../components/ReservationJudge";
import { SuccessionBanner } from "../components/SuccessionBanner";
import { dispatch, useNow, useSettings } from "../hooks/useCtdp";
import { Launcher } from "./Launcher";
import { NextUnit } from "./NextUnit";
import { SeatView } from "./SeatView";
import { SignDialog } from "./SignDialog";
import type { StartChoice } from "./StartOptions";

type Dim = "reserve" | "action" | null;

/** The one screen of daily use: reserve, act, sign. */
export function Home({ state, onMore }: { state: CtdpState; onMore: (tab?: string) => void }) {
  const settings = useSettings();
  const now = useNow();
  const toast = useToast();
  const [dim, setDim] = useState<Dim>(null);
  const [signing, setSigning] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [choice, setChoice] = useState<StartChoice>(() => ({
    chainId: state.primaryChainId ?? orderedChains(state)[0]?.id ?? "",
    ...settings.lastStart,
    task: "",
  }));

  const chains = orderedChains(state);
  const chain =
    chainOf(state, state.seat?.chainId) ?? chainOf(state, state.reservation?.chainId) ?? chainOf(state, choice.chainId) ?? chainOf(state, state.primaryChainId) ?? chains[0];

  // The mini window opens this window with what it wants done.
  useEffect(
    () =>
      window.ctdp.onIntent((intent) => {
        if (intent === "action") setDim("action");
        if (intent === "sign") setSigning(true);
        if (intent === "leave") setLeaving(true);
      }),
    [],
  );
  // Nothing to sign or leave once the sitting is gone (finished elsewhere, or on another device).
  useEffect(() => {
    if (!state.seat) {
      setSigning(false);
      setLeaving(false);
    }
  }, [state.seat]);

  if (!chain) {
    return (
      <section className="hero empty-hero">
        <span className="hero-label">Welcome</span>
        <p className="hero-text">Create a chain first: its sacred seat, and the signal for reservations.</p>
        <button className="primary big" onClick={() => onMore("chains")}>
          Create a chain
        </button>
      </section>
    );
  }

  const sitDown = async () => {
    setDim(null);
    const chunk = state.chunks.some((c) => c.id === choice.chunkId) ? choice.chunkId : null;
    await dispatch({ type: "seat", chainId: chain.id, chunkId: chain.main.open ? null : chunk, task: choice.task, minutes: choice.minutes, categoryId: choice.categoryId });
    if (!chain.main.open) await window.ctdp.updateSettings({ lastStart: { chunkId: chunk, minutes: choice.minutes, categoryId: choice.categoryId } });
    setChoice((c) => ({ ...c, task: "" }));
  };
  const reserve = async () => {
    setDim(null);
    await dispatch({ type: "reserve", chainId: chain.id });
  };
  const signed = (number: number) => {
    setSigning(false);
    toast.show(`#${number} signed`);
    window.setTimeout(() => window.ctdp.hideMain(), 1400);
  };

  return (
    <>
      {state.successionPending && <SuccessionBanner state={state} />}
      <ReservationJudge state={state} />

      {state.seat ? (
        <SeatView state={state} chain={chain} now={now} onFinish={() => setSigning(true)} onLeave={() => setLeaving(true)} />
      ) : chain.main.open ? (
        <NextUnit chain={chain} onAction={() => setDim("action")} />
      ) : (
        <Launcher
          state={state}
          chain={chain}
          now={now}
          choice={{ ...choice, chainId: chain.id }}
          onChoice={setChoice}
          onReserve={() => setDim("reserve")}
          onAction={() => setDim("action")}
        />
      )}

      {dim === "reserve" && (
        <DimPrompt
          kicker={`Reserve · ${chain.name}`}
          text={chain.auxiliary.signal}
          sub={`Give the signal. Then you have ${chain.auxiliary.windowMin} minutes to sit down.`}
          doneLabel="Done — start the countdown"
          onDone={() => void reserve()}
          onCancel={() => setDim(null)}
        />
      )}
      {dim === "action" && (
        <DimPrompt
          kicker={`Sacred seat · ${chain.name}`}
          text={chain.trigger}
          sub="Do it now. Once you are there, give it your best until you sign."
          doneLabel="Done — start"
          onDone={() => void sitDown()}
          onCancel={() => setDim(null)}
        />
      )}
      {signing && state.seat && <SignDialog chain={chain} seat={state.seat} onSigned={signed} onClose={() => setSigning(false)} />}
      {leaving && state.seat && (
        <ConfirmDialog
          title="Break the chain?"
          confirmLabel={state.seat.node.spec.freeAbandon ? "Abandon" : `Break chain (#${chain.main.counters[0].current} → 0)`}
          onConfirm={() => void dispatch({ type: "abandonUnit" }).then(() => setLeaving(false))}
          onCancel={() => setLeaving(false)}
        >
          {state.seat.node.spec.freeAbandon
            ? "This unit can be abandoned for free; the chain stays."
            : `Leaving now loses the whole ${chain.name} main track. This cannot be undone.`}
        </ConfirmDialog>
      )}
      {toast.node}
    </>
  );
}
