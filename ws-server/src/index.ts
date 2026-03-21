import { WebSocketServer, WebSocket } from "ws";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { verifyToken } from "./auth";
import { registerSocket, unregisterSocket } from "./rooms";
import { handleClientMessage, handleBroadcastEvent } from "./handlers";
import { URL } from "url";

const PORT = parseInt(process.env.PORT || "3001", 10);
const INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET || "dev-secret";

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Internal broadcast endpoint
  if (req.method === "POST" && req.url === "/broadcast") {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${INTERNAL_SECRET}`) {
      res.writeHead(401);
      res.end("Unauthorized");
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const event = JSON.parse(body);
        handleBroadcastEvent(event);
        res.writeHead(200);
        res.end("OK");
      } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");

  if (!token) {
    ws.close(4001, "Missing token");
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    ws.close(4001, "Invalid token");
    return;
  }

  registerSocket(ws, payload.userId);
  console.log(`[WS] User connected: ${payload.userId}`);

  ws.on("message", (raw) => {
    handleClientMessage(ws, raw.toString());
  });

  ws.on("close", () => {
    console.log(`[WS] User disconnected: ${payload.userId}`);
    unregisterSocket(ws);
  });

  ws.on("error", (err) => {
    console.error(`[WS] Error for ${payload.userId}:`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`[WS Server] Running on port ${PORT}`);
});
