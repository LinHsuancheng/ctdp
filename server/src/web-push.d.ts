// Minimal typings for the parts of web-push the server uses.
declare module "web-push" {
  export interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }
  export class WebPushError extends Error {
    statusCode: number;
  }
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function sendNotification(subscription: PushSubscription, payload?: string, options?: { TTL?: number }): Promise<unknown>;
}
