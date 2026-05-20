---
id: websocket-handler
title: "WebSocket handler — API Gateway WebSocket + Lambda (connect/disconnect/message)"
layer: stack
stack: react-supabase-lambda
tags: [websocket, realtime, api-gateway, lambda, aws]
applies_to:
  task_types: [add-handler, modify-handler]
  stages: [3, 5]
size_tokens: 250
related: [cognito-jwt-validation, lambda-handler, sqs-trigger]
---

# websocket-handler — API Gateway WebSocket Handler Pattern

## Pattern Summary

Three route handlers per WebSocket API: `$connect`, `$disconnect`, `$default`. Auth on `$connect` only. Connection IDs stored in RDS with branch context. Broadcasting uses `ApiGatewayManagementApiClient`.

**Route handler structure (`src/functions/realtime/`):**
```typescript
// $connect — auth, store connection
export const connectHandler: APIGatewayProxyHandler = async (event) => {
  const claims = await verifyToken(event.queryStringParameters?.token ?? "");
  if (!claims) return { statusCode: 401, body: "Unauthorized" };

  const connId   = event.requestContext.connectionId!;
  const branchId = extractBranchId(claims);

  await withRls(branchId, async (db) => {
    await db.query(
      "INSERT INTO ws_connections (connection_id, branch_id, connected_at) VALUES ($1, $2, NOW())",
      [connId, branchId],
    );
  });

  return { statusCode: 200, body: "Connected" };
};

// $disconnect — clean up
export const disconnectHandler: APIGatewayProxyHandler = async (event) => {
  const connId = event.requestContext.connectionId!;
  await db.query("DELETE FROM ws_connections WHERE connection_id = $1", [connId]);
  return { statusCode: 200, body: "Disconnected" };
};
```

**Broadcasting to branch connections:**
```typescript
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

export async function broadcastToBranch(branchId: string, payload: object) {
  const mgmt = new ApiGatewayManagementApiClient({
    endpoint: process.env.WEBSOCKET_ENDPOINT, // e.g. https://abc123.execute-api.region.amazonaws.com/prod
  });

  const rows = await db.query<{ connection_id: string }>(
    "SELECT connection_id FROM ws_connections WHERE branch_id = $1",
    [branchId],
  );

  await Promise.allSettled(
    rows.rows.map((r) =>
      mgmt.send(new PostToConnectionCommand({
        ConnectionId: r.connection_id,
        Data: Buffer.from(JSON.stringify(payload)),
      })).catch(() =>
        // Stale connection — 410 means gone, clean up
        db.query("DELETE FROM ws_connections WHERE connection_id = $1", [r.connection_id])
      ),
    ),
  );
}
```

## Full Reference

### `ws_connections` table
```sql
CREATE TABLE ws_connections (
  connection_id TEXT PRIMARY KEY,
  branch_id     UUID NOT NULL REFERENCES branches(id),
  connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON ws_connections (branch_id);
```

### Serverless YAML routes
```yaml
websocketApiId: !Ref WebsocketApi
events:
  - websocket:
      route: $connect
  - websocket:
      route: $disconnect
  - websocket:
      route: $default
```

### Auth on $connect
API Gateway does not send `Authorization` headers on WebSocket handshake from most browsers. Pass the JWT as a query parameter: `?token=<jwt>`. Validate on `$connect`, then trust the connection_id for subsequent messages — never re-validate per message.

### Forbidden
- Re-validating JWT on every `$default` message (kills throughput)
- Using DynamoDB for connections if RDS is already in the stack (adds another dependency)
- Ignoring 410 GoneException on broadcast (stale connections accumulate indefinitely)
- Sending the JWT in the body of `$default` messages (already authenticated via connection ID)
