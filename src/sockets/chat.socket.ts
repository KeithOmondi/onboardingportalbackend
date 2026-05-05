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
    const result = await pool.query(
      `INSERT INTO chat_messages
         (sender_id, sender_name, sender_role, recipient_id, recipient_type, target_roles, message)
       VALUES ($1, $2, $3, NULL, 'single', NULL, $4)
       RETURNING *`,
      [session.userId, session.name, session.role, data.message]
    );
    return { ...result.rows[0], _tempId: data._tempId } as ChatMessageDB;
  } catch (err) {
    console.error("[Socket] persistUserMessage error:", err);
    return null;
  }
};

// ── Push helper ───────────────────────────────────────────────

const truncate = (text: string, max = 80): string =>
  text.length > max ? text.slice(0, max - 3) + "..." : text;

// ── conversation:updated emitter ──────────────────────────────

const emitConversationUpdated = (
  io: Server,
  saved: ChatMessageDB,
  adminRoom: string,
  nonAdminUserId?: string
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
      if (nonAdminUserId) io.to(nonAdminUserId).emit("conversation:updated", payload);
      io.to(adminRoom).emit("conversation:updated", payload);
      break;
    case "broadcast":
      io.emit("conversation:updated", payload);
      break;
    case "group":
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

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: config.FRONTEND_URL, credentials: true },
  });

  const ADMIN_ROOM = "admin-support";

  io.on("connection", (socket: Socket) => {
    const { userId, role, name } = socket.handshake.query as {
      userId: string;
      role: string;
      name: string;
    };
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

      io.to(data.recipientId).emit("user:receive", saved);
      socket.emit("admin:message:sent", saved);
      emitConversationUpdated(io, saved, ADMIN_ROOM, data.recipientId);

      // Push notification to the recipient — fires even if their tab is closed
      sendPushToUser(data.recipientId, {
        title: "Message from ORHC Admin",
        body: truncate(data.message),
        url: "/judge/dashboard",
      }).catch((err: unknown) =>
        console.error("[Push] admin:message:single failed:", err)
      );
    });

    // ── Admin → broadcast ─────────────────────────────────────
    socket.on("admin:message:broadcast", async (data: AdminBroadcastDTO) => {
      if (!isAdmin) return;
      const saved = await persistBroadcast({ ...data, recipientType: "broadcast" });
      if (!saved) return socket.emit("admin:message:error", { _tempId: data._tempId });

      io.emit("broadcast:receive", saved);
      socket.emit("admin:message:sent", saved);
      emitConversationUpdated(io, saved, ADMIN_ROOM);

      // No push for broadcast — too broad and likely spammy
    });

    // ── Admin → group (role-based broadcast) ──────────────────
    socket.on("admin:message:group", async (data: AdminBroadcastDTO) => {
      if (!isAdmin) return;
      const saved = await persistBroadcast({ ...data, recipientType: "group" });
      if (!saved) return socket.emit("admin:message:error", { _tempId: data._tempId });

      if (saved.target_roles) {
        saved.target_roles.forEach((r) => io.to(`role:${r}`).emit("broadcast:receive", saved));
      }
      io.to(ADMIN_ROOM).emit("admin:receive", saved);
      socket.emit("admin:message:sent", saved);
      emitConversationUpdated(io, saved, ADMIN_ROOM);

      // Push each user whose role is in target_roles
      if (saved.target_roles && saved.target_roles.length > 0) {
        pool
          .query(
            `SELECT id FROM users
             WHERE role = ANY($1::text[])
               AND is_verified = true`,
            [saved.target_roles]
          )
          .then(({ rows }) =>
            Promise.allSettled(
              rows.map((row: { id: string }) =>
                sendPushToUser(row.id, {
                  title: "New message from ORHC Admin",
                  body: truncate(data.message),
                  url: "/judge/dashboard",
                })
              )
            )
          )
          .catch((err: unknown) =>
            console.error("[Push] admin:message:group failed:", err)
          );
      }
    });

    // ── User → Admin (DIRECT) ─────────────────────────────────
    socket.on("user:message", async (data: UserMessageDTO) => {
      if (isAdmin) return;
      const saved = await persistUserMessage(session, data);
      if (!saved) return socket.emit("user:message:error", { _tempId: data._tempId });

      io.to(ADMIN_ROOM).emit("admin:receive", saved);
      socket.emit("user:message:sent", saved);
      emitConversationUpdated(io, saved, ADMIN_ROOM, session.userId);

      // Push notification to all admins — fires even if their browser is closed
      sendPushToAdmins({
        title: `New message from ${session.name}`,
        body: truncate(data.message),
        url: "/superadmin/messages",
      }).catch((err: unknown) =>
        console.error("[Push] user:message push failed:", err)
      );
    });
  });

  return io;
};
