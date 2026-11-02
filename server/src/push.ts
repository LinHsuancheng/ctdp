import webpush, { type PushSubscription } from "web-push";
import type { Reminder } from "./reminders";
import type { SyncStore } from "./store";

export interface PushSender {
  publicKey: string;
  send(reminder: Pick<Reminder, "title" | "body">): Promise<void>;
}

/** Web Push to every subscribed device. VAPID keys are created once and kept in the store. */
export function createPushSender(store: SyncStore, subject: string): PushSender {
  let keys = store.vapidKeys();
  if (!keys) {
    keys = webpush.generateVAPIDKeys();
    store.setVapidKeys(keys);
  }
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);

  const deliver = async (sub: PushSubscription, payload: string) => {
    try {
      await webpush.sendNotification(sub, payload, { TTL: 600 });
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // Gone or unknown: the device unsubscribed or the app was removed.
      if (status === 404 || status === 410) store.unsubscribe(sub.endpoint);
      else console.error(`push to ${new URL(sub.endpoint).host} failed:`, err);
    }
  };

  return {
    publicKey: keys.publicKey,
    async send({ title, body }) {
      const payload = JSON.stringify({ title, body });
      await Promise.all(store.subscriptions().map((s) => deliver(s, payload)));
    },
  };
}
