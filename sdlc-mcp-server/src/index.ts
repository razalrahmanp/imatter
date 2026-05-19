import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";
import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

const MODE = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();

// ── stdio mode (Claude Code CLI) ──────────────────────────────────────────────
async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[sdlc-mcp] running on stdio\n");

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

// ── HTTP mode (claude.ai marketplace) ────────────────────────────────────────
async function runHttp(): Promise<void> {
  const PORT = parseInt(process.env.PORT ?? "3000", 10);
  const app = express();
  app.use(express.json());

  // One McpServer instance; a new transport per client session
  const mcpServer = createServer();
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  async function getOrCreateTransport(
    sessionId: string | undefined
  ): Promise<StreamableHTTPServerTransport> {
    if (sessionId) {
      const existing = sessions.get(sessionId);
      if (existing) return existing;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, transport);
      },
    });

    await mcpServer.connect(transport);
    return transport;
  }

  // Main MCP endpoint — handles all Streamable HTTP MCP traffic
  app.all("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    try {
      const transport = await getOrCreateTransport(sessionId);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: String(err) });
      }
    }
  });

  // Session teardown
  app.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      await sessions.get(sessionId)!.close();
      sessions.delete(sessionId);
    }
    res.status(200).end();
  });

  // Health probe (used by Vercel / Railway / Fly.io)
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", server: "sdlc-validation", sessions: sessions.size });
  });

  const httpServer = app.listen(PORT, () => {
    console.log(`[sdlc-mcp] HTTP server listening on :${PORT}`);
    console.log(`[sdlc-mcp] MCP endpoint: http://localhost:${PORT}/mcp`);
  });

  const shutdown = async (): Promise<void> => {
    httpServer.close();
    for (const [id, t] of sessions) {
      await t.close();
      sessions.delete(id);
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// ── Entry point ───────────────────────────────────────────────────────────────
if (MODE === "http") {
  runHttp().catch((err) => {
    process.stderr.write(`[sdlc-mcp] fatal: ${err}\n`);
    process.exit(1);
  });
} else {
  runStdio().catch((err) => {
    process.stderr.write(`[sdlc-mcp] fatal: ${err}\n`);
    process.exit(1);
  });
}
