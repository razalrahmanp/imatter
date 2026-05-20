---
name: sdlc-fcm-push
description: Use when implementing Firebase Cloud Messaging push notifications from a backend (typically via SQS-triggered worker) — covers Admin SDK singleton, invalid-token cleanup, and the device_tokens table shape.
---

## When to use

- Sending push notifications via Firebase Cloud Messaging from a server-side worker
- Handling FCM token registration and rotation from mobile clients
- Auditing existing push code for invalid-token cleanup gaps

## Architecture

```
app   →  POST /notifications/send  →  SQS queue  →  Lambda worker  →  FCM
                                                       │
                                                       └→ on invalid token → DELETE from device_tokens
```

The HTTP endpoint enqueues; the worker is the only thing that touches Firebase Admin SDK. This keeps cold-start latency off the user request and gives natural retry/DLQ behavior.

## Firebase Admin SDK singleton

The Admin SDK is heavy — initialize once per Lambda container, not per invocation. Credentials come from Secrets Manager.

```ts
import admin from "firebase-admin";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

let app: admin.app.App | null = null;

export async function getFirebaseAdmin(): Promise<admin.app.App> {
  if (app) return app;

  const client = new SecretsManagerClient({});
  const res = await client.send(new GetSecretValueCommand({ SecretId: process.env.FCM_SECRET_ARN! }));
  const serviceAccount = JSON.parse(res.SecretString!);

  app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return app;
}
```

## device_tokens table

```sql
CREATE TABLE device_tokens (
  user_id     UUID    NOT NULL,
  platform    TEXT    NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  fcm_token   TEXT    NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, platform)
);
```

One row per `(user_id, platform)` — the client re-registers and overwrites on token rotation. Index `fcm_token` only if you need reverse lookup; otherwise the PK is enough.

## Worker pattern with cleanup

```ts
export const handler = async (event: SQSEvent) => {
  const app = await getFirebaseAdmin();
  const messaging = admin.messaging(app);

  for (const record of event.Records) {
    const { user_id, title, body, data } = JSON.parse(record.body);

    const tokens = await db.query(
      "SELECT platform, fcm_token FROM device_tokens WHERE user_id = $1",
      [user_id]
    );
    if (tokens.length === 0) continue;

    const results = await messaging.sendEachForMulticast({
      tokens: tokens.map(t => t.fcm_token),
      notification: { title, body },
      data,
    });

    // Clean up invalid tokens
    await Promise.all(results.responses.map(async (r, i) => {
      if (r.success) return;
      const code = r.error?.code;
      if (code === "messaging/registration-token-not-registered"
       || code === "messaging/invalid-registration-token") {
        await db.query(
          "DELETE FROM device_tokens WHERE user_id = $1 AND fcm_token = $2",
          [user_id, tokens[i].fcm_token]
        );
      }
    }));
  }
};
```

Only `registration-token-not-registered` and `invalid-registration-token` mean "delete this token." Other errors (rate-limit, quota, transient) should be retried via SQS, not cleaned up.

## Forbidden

- ❌ Initializing `admin.initializeApp` on every invocation (cold-start penalty + SDK warnings)
- ❌ Putting the service account JSON in env vars (use Secrets Manager)
- ❌ Logging the FCM token itself — it's a credential, treat it like one
- ❌ Deleting tokens on transient errors (only on `not-registered` / `invalid-registration-token`)
- ❌ Calling FCM synchronously from a user-facing HTTP endpoint (use SQS)

## Gate criteria

- Firebase Admin SDK is initialized once per container (singleton check)
- Service account comes from Secrets Manager, not an env var or repo file
- `device_tokens` table has `(user_id, platform)` PK
- Invalid-token cleanup runs only on the two specific error codes
- Push send goes through SQS, not directly from the HTTP request handler
