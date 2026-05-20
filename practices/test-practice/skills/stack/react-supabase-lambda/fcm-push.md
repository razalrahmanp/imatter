---
id: fcm-push
title: "FCM push — Firebase Cloud Messaging via Admin SDK from Lambda"
layer: stack
stack: react-supabase-lambda
tags: [firebase, fcm, push, notifications, aws, lambda]
applies_to:
  task_types: [add-worker, modify-worker, add-handler]
  stages: [3, 5]
size_tokens: 230
related: [lambda-worker, secrets-management, structured-logging]
context7_library_id: /firebase/firebase-admin-node
---

# fcm-push — Firebase Cloud Messaging Push Pattern

## Pattern Summary

All push notifications go through a single Lambda worker. Never call FCM from request-path handlers. Firebase Admin SDK initialised once at module level from Secrets Manager credentials.

**SDK initialisation (`src/shared/fcm.ts`):**
```typescript
import * as admin from "firebase-admin";
import { getSecret } from "./secrets";

let app: admin.app.App | null = null;

async function getFcmApp(): Promise<admin.app.App> {
  if (app) return app;
  const creds = JSON.parse(await getSecret(process.env.FCM_SECRET_NAME!));
  app = admin.initializeApp({
    credential: admin.credential.cert(creds),
  });
  return app;
}

export async function sendPush(token: string, payload: PushPayload): Promise<void> {
  const fcmApp = await getFcmApp();
  await admin.messaging(fcmApp).send({
    token,
    notification: { title: payload.title, body: payload.body },
    data:         payload.data ?? {},
    android:      { priority: "high" },
    apns:         { payload: { aps: { sound: "default" } } },
  });
}
```

**Worker dispatching pushes from SQS:**
```typescript
// src/functions/notifications/push-worker.ts
export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const { token, payload } = JSON.parse(record.body) as PushJob;
    try {
      await sendPush(token, payload);
    } catch (err: unknown) {
      if (isUnregisteredToken(err)) {
        // Token is invalid — remove from DB, do not DLQ
        await db.query("DELETE FROM device_tokens WHERE fcm_token = $1", [token]);
      } else {
        throw err; // triggers SQS DLQ retry
      }
    }
  }
};

function isUnregisteredToken(err: unknown): boolean {
  return err instanceof Error && err.message.includes("registration-token-not-registered");
}
```

## Full Reference

### Device token registration
```typescript
// Store per-user, per-device. One user can have multiple devices.
await db.query(
  `INSERT INTO device_tokens (user_id, fcm_token, platform, updated_at)
   VALUES ($1, $2, $3, NOW())
   ON CONFLICT (user_id, platform) DO UPDATE SET fcm_token = $2, updated_at = NOW()`,
  [userId, fcmToken, platform],
);
```

### `device_tokens` schema
```sql
CREATE TABLE device_tokens (
  user_id    UUID NOT NULL,
  platform   TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  fcm_token  TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, platform)
);
```

### Sending from request path (wrong — for context)
Never call `sendPush` from a handler directly. Put a message on the SQS notifications queue; the push-worker processes asynchronously. This keeps p99 latency on the request path unaffected by FCM network latency.

### Forbidden
- Hardcoding Firebase credentials in code or environment variables — use Secrets Manager
- Calling FCM from a synchronous request handler (adds FCM latency to p99)
- Ignoring `registration-token-not-registered` errors (tokens accumulate forever)
- Using `sendMulticast` with >500 tokens per call (FCM hard limit)
