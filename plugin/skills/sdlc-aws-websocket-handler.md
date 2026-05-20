---
name: sdlc-aws-websocket-handler
description: Use when implementing AWS API Gateway WebSocket routes ($connect, $disconnect, or message routes) — covers JWT-on-handshake auth, connection-table tracking, and broadcast with GoneException handling.
---

## When to use

- Implementing `$connect`, `$disconnect`, or any message route on an AWS API Gateway WebSocket API
- Sending server-pushed updates to connected clients (e.g. live order status, dashboard tiles)
- Migrating polling-based features to WebSockets

## Auth on handshake (one-time)

JWT is passed as a query string parameter on the WebSocket handshake:

```
wss://ws.example.com/?token=<jwt>
```

It is verified **only** on the `$connect` route. Subsequent messages are trusted because the connection itself is authenticated.

```ts
export const onConnect = async (event: APIGatewayProxyEvent) => {
  const token = event.queryStringParameters?.token;
  if (!token) return { statusCode: 401, body: "missing token" };

  const claims = await verifyJwt(token); // throws on invalid
  await ddb.put({
    TableName: "ws_connections",
    Item: { connection_id: event.requestContext.connectionId, tenant_id: claims.tenant_id },
  });
  return { statusCode: 200, body: "connected" };
};
```

## Connection table shape

```
ws_connections
  connection_id   STRING  PK
  tenant_id       STRING  GSI partition (for broadcast)
  user_id         STRING
  connected_at    NUMBER  (epoch seconds)
```

On `$disconnect`, delete the row. Do not rely on TTL alone — disconnect events are usually delivered.

## Broadcast pattern

```ts
import { ApiGatewayManagementApiClient, PostToConnectionCommand, GoneException }
  from "@aws-sdk/client-apigatewaymanagementapi";

export async function broadcastToTenant(tenantId: string, payload: unknown) {
  const client = new ApiGatewayManagementApiClient({
    endpoint: process.env.WS_CALLBACK_URL,
  });

  const conns = await ddb.query({
    TableName: "ws_connections",
    IndexName: "tenant_id-index",
    KeyConditionExpression: "tenant_id = :t",
    ExpressionAttributeValues: { ":t": tenantId },
  });

  await Promise.all(conns.Items.map(async ({ connection_id }) => {
    try {
      await client.send(new PostToConnectionCommand({
        ConnectionId: connection_id,
        Data: Buffer.from(JSON.stringify(payload)),
      }));
    } catch (err) {
      if (err instanceof GoneException) {
        // Connection is dead — clean up.
        await ddb.delete({ TableName: "ws_connections", Key: { connection_id } });
        return;
      }
      throw err;
    }
  }));
}
```

## Forbidden

- ❌ Verifying JWT on every message (handshake-only is the contract)
- ❌ Sending PII or secrets in `Data` payloads — assume the connection is on a hostile network
- ❌ Long-running work in `$connect` — return within 1 second or the handshake times out
- ❌ Using a single global `ApiGatewayManagementApiClient` if your code spans multiple endpoints; create per-endpoint

## Gate criteria

- `$connect` handler verifies JWT, writes a connection row
- `$disconnect` handler deletes the connection row
- `GoneException` is caught in every broadcast call and triggers cleanup
- Connection table has a GSI on whatever broadcast partition you use (tenant, room, channel)
