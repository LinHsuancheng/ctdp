import { formatDateTime } from "../../../shared/ctdp";
import type { SyncView } from "../../../shared/ipc";

export const deviceLabel = (device: string, view: SyncView) => (device === view.deviceId ? "this device" : `device ${device}`);

/** Tells the user, once, which actions lost out when logs from several devices were merged. */
export function VoidedBanner({ view }: { view: SyncView }) {
  if (view.unseen.length === 0) return null;
  return (
    <section className="card warn">
      <h2>{view.unseen.length === 1 ? "An action was voided" : `${view.unseen.length} actions were voided`} when merging devices</h2>
      <p className="hint">Something earlier on another device made these impossible, so they had no effect. They stay marked in History.</p>
      <ul className="list">
        {view.unseen.map((v) => (
          <li key={v.id}>
            <span className="list-main">
              {v.text}
              <span className="list-sub">{deviceLabel(v.device, view)}</span>
            </span>
            <span className="list-meta">{formatDateTime(v.at)}</span>
          </li>
        ))}
      </ul>
      <div className="row">
        <button className="secondary small" onClick={() => void window.ctdp.ackVoided()}>
          Got it
        </button>
      </div>
    </section>
  );
}
