import type { Outcome, PushApi, PushStatus } from "../shared/ipc";

type Call = <T>(path: string, body?: unknown) => Promise<T>;

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => matchMedia("(display-mode: standalone)").matches;

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Never waits for a worker that may not exist (`ready` would hang forever). */
async function subscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** The active worker, which subscribing needs; it may still be installing on the first visit. */
function activeWorker(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("The app is not fully installed yet; close and reopen it, then try again.")), 10_000),
  );
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/**
 * Web Push through the sync server. Being subscribed is this device's
 * notification switch; `onChange` mirrors it into the device settings.
 */
export function createPush(call: Call, deviceId: () => string, onChange: (on: boolean) => void): PushApi {
  const status = async (): Promise<PushStatus> => {
    if (!supported()) {
      const message =
        isIos() && !standalone()
          ? "On iPhone, add CTDP to the Home Screen first (Share → Add to Home Screen) and open it from there."
          : "This browser cannot receive notifications.";
      return { state: "unsupported", message };
    }
    if (Notification.permission === "denied") return { state: "denied", message: "Notifications are blocked for CTDP in the system settings." };
    const on = (await subscription()) !== null;
    return on
      ? { state: "on", message: "Reminders arrive on this device even when CTDP is closed." }
      : { state: "off", message: "Notifications are off on this device." };
  };

  const fail = (err: unknown): Outcome => ({ ok: false, message: (err as Error).message });

  return {
    status,
    async enable() {
      if (!supported()) return { ok: false, message: (await status()).message };
      // Ask first, while still inside the tap.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return { ok: false, message: "Permission was not given, so notifications stay off." };
      try {
        const { publicKey } = await call<{ publicKey: string }>("/api/push/key");
        const reg = await activeWorker();
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
        await call("/api/push/subscribe", { device: deviceId(), subscription: sub.toJSON() });
        onChange(true);
        return { ok: true, message: "Notifications are on." };
      } catch (err) {
        return fail(err);
      }
    },
    async disable() {
      if (!supported()) {
        onChange(false);
        return { ok: true, message: "Notifications are off." };
      }
      try {
        const sub = await subscription();
        if (sub) {
          await call("/api/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
          await sub.unsubscribe();
        }
        onChange(false);
        return { ok: true, message: "Notifications are off." };
      } catch (err) {
        return fail(err);
      }
    },
    async test() {
      try {
        await call("/api/push/test", {});
        return { ok: true, message: "Sent. It should arrive in a few seconds." };
      } catch (err) {
        return fail(err);
      }
    },
  };
}
