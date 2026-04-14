import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import config from "../config/env";
import pool from "../config/db";

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

interface ConversationUpdatedPayload {
  conversationId: string;   // always the non-admin user's id
  lastMessage: string;
  lastMessageAt: Date;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientType: "single" | "broadcast" | "group";
  targetRoles?: string[] | null;
}

interface AdminSingleDTO {
  _tempId?: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  recipientType: "single";
  message: string;
}

interface AdminBroadcastDTO {
  _tempId?: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientType: "broadcast" | "group";
  targetRoles?: string[];
  message: string;
}

interface UserMessageDTO {
  _tempId?: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  recipient_type: "single";
  message: string;
  created_at?: string | Date;
}

// ── DB helpers ────────────────────────────────────────────────

const persistSingle = async (data: AdminSingleDTO): Promise<ChatMessageDB | null> => {
  try {
    const result = await pool.query(
      `INSERT INTO chat_messages
         (sender_id, sender_name, sender_role, recipient_id, recipient_type, target_roles, message)
       VALUES ($1, $2, $3, $4, 'single', NULL, $5)
       RETURNING *`,
      [data.senderId, data.senderName, data.senderRole, data.recipientId, data.message]
    );
    return { ...result.rows[0], _tempId: data._tempId } as ChatMessageDB;
  } catch (err) {
    console.error("[Socket] persistSingle error:", err);
    return null;
  }
};

const persistBroadcast = async (data: AdminBroadcastDTO): Promise<ChatMessageDB | null> => {
  try {
    const result = await pool.query(
      `INSERT INTO chat_messages
         (sender_id, sender_name, sender_role, recipient_id, recipient_type, target_roles, message)
       VALUES ($1, $2, $3, NULL, $4, $5, $6)
       RETURNING *`,
      [
        data.senderId,
        data.senderName,
        data.senderRole,
        data.recipientType,
        data.targetRoles ?? null,
        data.message,
      ]
    );
    return { ...result.rows[0], _tempId: data._tempId } as ChatMessageDB;
  } catch (err) {
    console.error("[Socket] persistBroadcast error:", err);
    return null;
  }
};

const persistUserMessage = async (
  session: { userId: string; name: string; role: string },
  data: UserMessageDTO
): Promise<ChatMessageDB | null> => {
  try {
    // 1. Identify the Admin ID. 
    // If your system has multiple admins, you might need to pass the admin's ID 
    // from the frontend in the 'data' payload.
    const DEFAULT_ADMIN_ID = "00000000-0000-0000-0000-000000000000"; // Replace with actual Super Admin UUID

    const result = await pool.query(
      `INSERT INTO chat_messages
          (sender_id, sender_name, sender_role, recipient_id, recipient_type, target_roles, message)
        VALUES ($1, $2, $3, $4, 'single', NULL, $5)
        RETURNING *`,
      [
        session.userId, 
        session.name, 
        session.role, 
        data.sender_id || DEFAULT_ADMIN_ID, // Ensure recipient_id is NOT NULL
        data.message
      ]
    );
    return { ...result.rows[0], _tempId: data._tempId } as ChatMessageDB;
  } catch (err) {
    console.error("[Socket] persistUserMessage error:", err);
    return null;
  }
};

// ── conversation:updated emitter ──────────────────────────────

/**
 * Builds a ConversationUpdatedPayload from a saved message and fans it out
 * to all parties who need to re-sort their conversation list or bump a badge.
 *
 * Convention: conversationId is ALWAYS the non-admin user's id so both
 * the admin panel and the user's client share the same stable key.
 *
 *   single    → the non-admin is either the sender or the recipient
 *   broadcast → no single user; conversationId is "broadcast"
 *   group     → no single user; conversationId is "group:<roles>"
 */
const emitConversationUpdated = (
  io: Server,
  saved: ChatMessageDB,
  adminRoom: string,
  nonAdminUserId?: string   // caller supplies this; avoids re-deriving it here
) => {
  const conversationId =
    saved.recipient_type === "single"
      ? (nonAdminUserId ?? saved.recipient_id ?? saved.sender_id)
      : saved.recipient_type === "group"
      ? `group:${(saved.target_roles ?? []).join(",")}`
      : "broadcast";

  const payload: ConversationUpdatedPayload = {
    conversationId,
    lastMessage: saved.message,
    lastMessageAt: saved.created_at,
    senderId: saved.sender_id,
    senderName: saved.sender_name,
    senderRole: saved.sender_role,
    recipientType: saved.recipient_type,
    targetRoles: saved.target_roles,
  };

  switch (saved.recipient_type) {
    case "single":
      // Notify the non-admin user (badge++ if their convo isn't open)
      if (nonAdminUserId) io.to(nonAdminUserId).emit("conversation:updated", payload);
      // Notify all admins (re-sort their inbox)
      io.to(adminRoom).emit("conversation:updated", payload);
      break;

    case "broadcast":
      // Every connected socket needs to re-sort
      io.emit("conversation:updated", payload);
      break;

    case "group":
      // Only the targeted role rooms + admins
      if (saved.target_roles) {
        saved.target_roles.forEach((r) =>
          io.to(`role:${r}`).emit("conversation:updated", payload)
        );
      }
      io.to(adminRoom).emit("conversation:updated", payload);
      break;
  }
};

// ── Socket server ─────────────────────────────────────────────

// ... (Keep existing imports and DB helpers)

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: config.FRONTEND_URL, credentials: true },
  });

  const ADMIN_ROOM = "admin-support";

  io.on("connection", (socket: Socket) => {
    const { userId, role, name } = socket.handshake.query as any;
    if (!userId || !role) return socket.disconnect();

    const session = { userId, role, name };
    const isAdmin = role.toLowerCase().includes("admin");

    socket.join(userId);
    socket.join(`role:${role}`);
    if (isAdmin) socket.join(ADMIN_ROOM);

    // ── Admin → single user (DIRECT) ──────────────────────────
    socket.on("admin:message:single", async (data: AdminSingleDTO) => {
      if (!isAdmin) return;
      const saved = await persistSingle(data);
      if (!saved) return socket.emit("admin:message:error", { _tempId: data._tempId });

      io.to(data.recipientId).emit("user:receive", saved); // Direct event
      socket.emit("admin:message:sent", saved);
      emitConversationUpdated(io, saved, ADMIN_ROOM, data.recipientId);
    });

    // ── Admin → broadcast (BROADCAST) ────────────────────────
    socket.on("admin:message:broadcast", async (data: AdminBroadcastDTO) => {
      if (!isAdmin) return;
      const saved = await persistBroadcast({ ...data, recipientType: "broadcast" });
      if (!saved) return socket.emit("admin:message:error", { _tempId: data._tempId });

      io.emit("broadcast:receive", saved); // Specific Broadcast event
      socket.emit("admin:message:sent", saved);
      emitConversationUpdated(io, saved, ADMIN_ROOM);
    });

    // ── Admin → group (BROADCAST for specific roles) ──────────
    socket.on("admin:message:group", async (data: AdminBroadcastDTO) => {
      if (!isAdmin) return;
      const saved = await persistBroadcast({ ...data, recipientType: "group" });
      if (!saved) return socket.emit("admin:message:error", { _tempId: data._tempId });

      if (saved.target_roles) {
        // Targeted Broadcast event
        saved.target_roles.forEach((r) => io.to(`role:${r}`).emit("broadcast:receive", saved));
      }
      io.to(ADMIN_ROOM).emit("admin:receive", saved);
      socket.emit("admin:message:sent", saved);
      emitConversationUpdated(io, saved, ADMIN_ROOM);
    });

    // ── User → Admin (DIRECT) ─────────────────────────────────
    socket.on("user:message", async (data: UserMessageDTO) => {
      if (isAdmin) return;
      const saved = await persistUserMessage(session, data);
      if (!saved) return socket.emit("user:message:error", { _tempId: data._tempId });

      io.to(ADMIN_ROOM).emit("admin:receive", saved);
      socket.emit("user:message:sent", saved);
      emitConversationUpdated(io, saved, ADMIN_ROOM, session.userId);
    });
  });

  return io;
};