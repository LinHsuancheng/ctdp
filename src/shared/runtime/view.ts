import { voidedOf } from "../ctdp";
import type { SyncView } from "../ipc";
import type { Device } from "./device";
import type { Engine } from "./engine";
import type { SyncClient } from "./sync";

/** What the UI shows about syncing and merge results. */
export function buildSyncView(engine: Engine, device: Device, client: SyncClient): SyncView {
  const voided = voidedOf(engine.voided(), engine.get());
  const seen = new Set(device.seenVoided);
  return { ...client.status(), deviceId: device.id, voided, unseen: voided.filter((v) => !seen.has(v.id)) };
}

/** Marks every voided action as seen. */
export function ackVoided(engine: Engine, device: Device): void {
  device.seenVoided = engine.voided().map((e) => e.id);
}
