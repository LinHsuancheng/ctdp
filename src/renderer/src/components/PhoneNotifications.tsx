import { useEffect, useState } from "react";
import type { Outcome, PushApi, PushStatus } from "../../../shared/ipc";

/** The phone's notification switch: subscribes this device to reminders pushed by the sync server. */
export function PhoneNotifications({ push }: { push: PushApi }) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [result, setResult] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => void push.status().then(setStatus);
  useEffect(refresh, [push]);

  const run = (op: () => Promise<Outcome>) => {
    setBusy(true);
    void op().then((r) => {
      setBusy(false);
      setResult(r);
      refresh();
    });
  };

  return (
    <section className="card">
      <h2>This device</h2>
      <p className="hint">
        Reminders when a reservation is about to run out, when it runs out, and when the minimum time is reached. This switch only affects this phone.
      </p>
      {status && <p className={status.state === "denied" || status.state === "unsupported" ? "notice" : "hint"}>{status.message}</p>}
      <div className="row">
        {status?.state === "off" && (
          <button className="primary" disabled={busy} onClick={() => run(push.enable)}>
            Turn on notifications
          </button>
        )}
        {status?.state === "on" && (
          <>
            <button className="secondary small" disabled={busy} onClick={() => run(push.test)}>
              Send a test
            </button>
            <button className="ghost small danger" disabled={busy} onClick={() => run(push.disable)}>
              Turn off
            </button>
          </>
        )}
      </div>
      {result && <p className={result.ok ? "notice ok" : "notice"}>{result.message}</p>}
    </section>
  );
}
