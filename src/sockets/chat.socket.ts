import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import config from "../config/env";
import pool from "../config/db";
import { sendPushToAdmins, sendPushToUser } from "../controllers/push.controller";

// ── Types ─────────────────────────────────────────────────────

interface ChatMessageDB {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  recipient_id: string | null;
  recipient_type: "single" | "group" | "broadcast";
  target_roles: string[] | null;
  message: string;
  created_at: Date;
  _tempId?: string;
}

// ── 🔒 CORE: Fetch user from DB (single source of truth) ───────

const getUserFromDB = async (userId: string) => {
  const result = await pool.query(
    `SELECT name, role FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );

  if (result.rowCount === 0) return null;

  return result.rows[0] as { name: string; role: string };
};

// ── DB helpers ────────────────────────────────────────────────

const persistSingle = async (
  senderId: string,
  recipientId: string,
  message: string,
  _tempId?: string
): Promise<ChatMessageDB | null> => {
  try {
    const user = await getUserFromDB(senderId);
    if (!user) throw new Error("Sender not found");

    const result = await pool.query(
      `INSERT INTO chat_messages
         (sender_id, sender_name, sender_role, recipient_id, recipient_type, target_roles, message)
       VALUES ($1, $2, $3, $4, 'single', NULL, $5)
       RETURNING *`,
      [senderId, user.name, user.role, recipientId, message]
    );

    return { ...result.rows[0], _tempId };
  } catch (err) {
    console.error("[Socket] persistSingle error:", err);
    return null;
  }
};

const persistBroadcast = async (
  senderId: string,
  message: string,
  recipientType: "broadcast" | "group",
  targetRoles?: string[],
  _tempId?: string
): Promise<ChatMessageDB | null> => {
  try {
    const user = await getUserFromDB(senderId);
    if (!user) throw new Error("Sender not found");

    const result = await pool.query(
      `INSERT INTO chat_messages
         (sender_id, sender_name, sender_role, recipient_id, recipient_type, target_roles, message)
       VALUES ($1, $2, $3, NULL, $4, $5, $6)
       RETURNING *`,
      [senderId, user.name, user.role, recipientType, targetRoles ?? null, message]
    );

    return { ...result.rows[0], _tempId };
  } catch (err) {
    console.error("[Socket] persistBroadcast error:", err);
    return null;
  }
};

const persistUserMessage = async (
  senderId: string,
  message: string,
  _tempId?: string
): Promise<ChatMessageDB | null> => {
  try {
    const user = await getUserFromDB(senderId);
    if (!user) throw new Error("Sender not found");

    const result = await pool.query(
      `INSERT INTO chat_messages
         (sender_id, sender_name, sender_role, recipient_id, recipient_type, target_roles, message)
       VALUES ($1, $2, $3, NULL, 'single', NULL, $4)
       RETURNING *`,
      [senderId, user.name, user.role, message]
    );

    return { ...result.rows[0], _tempId };
  } catch (err) {
    console.error("[Socket] persistUserMessage error:", err);
    return null;
  }
};

// ── Helpers ───────────────────────────────────────────────────

const truncate = (text: string, max = 80): string =>
  text.length > max ? text.slice(0, max - 3) + "..." : text;

// ── Socket server ─────────────────────────────────────────────

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: config.FRONTEND_URL, credentials: true },
  });

  const ADMIN_ROOM = "admin-support";

  io.on("connection", async (socket: Socket) => {
    const { userId } = socket.handshake.query as { userId: string };

    if (!userId) return socket.disconnect();

    // 🔒 Always fetch role from DB
    const user = await getUserFromDB(userId);
    if (!user) return socket.disconnect();

    const { role, name } = user;
    const isAdmin = role.toLowerCase().includes("admin");

    socket.join(userId);
    socket.join(`role:${role}`);
    if (isAdmin) socket.join(ADMIN_ROOM);

    // ── Admin → single ────────────────────────────────────────
    socket.on("admin:message:single", async (data: any) => {
      if (!isAdmin) return;

      const saved = await persistSingle(
        userId,
        data.recipientId,
        data.message,
        data._tempId
      );

      if (!saved) return socket.emit("admin:message:error");

      io.to(data.recipientId).emit("user:receive", saved);
      socket.emit("admin:message:sent", saved);

      sendPushToUser(data.recipientId, {
        title: "Message from Admin",
        body: truncate(data.message),
        url: "/judge/dashboard",
      }).catch(console.error);
    });

    // ── Admin → broadcast ─────────────────────────────────────
    socket.on("admin:message:broadcast", async (data: any) => {
      if (!isAdmin) return;

      const saved = await persistBroadcast(
        userId,
        data.message,
        "broadcast",
        undefined,
        data._tempId
      );

      if (!saved) return socket.emit("admin:message:error");

      io.emit("broadcast:receive", saved);
      socket.emit("admin:message:sent", saved);
    });

    // ── Admin → group ─────────────────────────────────────────
    socket.on("admin:message:group", async (data: any) => {
      if (!isAdmin) return;

      const saved = await persistBroadcast(
        userId,
        data.message,
        "group",
        data.targetRoles,
        data._tempId
      );

      if (!saved) return socket.emit("admin:message:error");

      if (saved.target_roles) {
        saved.target_roles.forEach((r) =>
          io.to(`role:${r}`).emit("broadcast:receive", saved)
        );
      }

      io.to(ADMIN_ROOM).emit("admin:receive", saved);
      socket.emit("admin:message:sent", saved);
    });

    // ── User → admin ──────────────────────────────────────────
    socket.on("user:message", async (data: any) => {
      if (isAdmin) return;

      const saved = await persistUserMessage(
        userId,
        data.message,
        data._tempId
      );

      if (!saved) return socket.emit("user:message:error");

      io.to(ADMIN_ROOM).emit("admin:receive", saved);
      socket.emit("user:message:sent", saved);

      sendPushToAdmins({
        title: `New message from ${name}`,
        body: truncate(data.message),
        url: "/superadmin/messages",
      }).catch(console.error);
    });
  });

  return io;
};
