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
  conversationId: string;
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

// ── Validation helpers ────────────────────────────────────────

const isNonEmpty = (val: unknown): val is string =>
  typeof val === "string" && val.trim().length > 0;

const validateAdminSingle = (data: AdminSingleDTO): string | null => {
  if (!isNonEmpty(data.senderId))    return "missing senderId";
  if (!isNonEmpty(data.senderName))  return "missing senderName";
  if (!isNonEmpty(data.senderRole))  return "missing senderRole";
  if (!isNonEmpty(data.recipientId)) return "missing recipientId";
  if (!isNonEmpty(data.message))     return "missing message";
  return null;
};

const validateAdminBroadcast = (data: AdminBroadcastDTO): string | null => {
  if (!isNonEmpty(data.senderId))   return "missing senderId";
  if (!isNonEmpty(data.senderName)) return "missing senderName";
  if (!isNonEmpty(data.senderRole)) return "missing senderRole";
  if (!isNonEmpty(data.message))    return "missing message";
  if (
    data.recipientType === "group" &&
    (!Array.isArray(data.targetRoles) || data.targetRoles.length === 0)
  ) return "missing targetRoles for group message";
  return null;
};

const validateUserMessage = (
  session: { userId: string; name: string; role: string },
  data: UserMessageDTO
): string | null => {
  if (!isNonEmpty(session.userId)) return "missing session userId";
  if (!isNonEmpty(session.name))   return "missing session name";
  if (!isNonEmpty(session.role))   return "missing session role";
  if (!isNonEmpty(data.message))   return "missing message";
  return null;
};

// ── DB helpers ────────────────────────────────────────────────

const persistSingle = async (data: AdminSingleDTO): Promise<ChatMessageDB | null> => {
  const values = [
    data.senderId,
    data.senderName,
    data.senderRole,
    data.recipientId,
    data.message,
  ];
  console.log("[persistSingle] values:", values);
  try {
    const result = await pool.query(
      `INSERT INTO chat_messages
         (sender_id, sender_name, sender_role, recipient_id, recipient_type, target_roles, message)
       VALUES ($1, $2, $3, $4, 'single', NULL, $5)
       RETURNING *`,
      values
    );
    return { ...result.rows[0], _tempId: data._tempId } as ChatMessageDB;
  } catch (err) {
    console.error("[Socket] persistSingle error:", err);
    return null;
  }
};

const persistBroadcast = async (data: AdminBroadcastDTO): Promise<ChatMessageDB | null> => {
  const values = [
    data.senderId,
    data.senderName,
    data.senderRole,
    data.recipientType,
    data.targetRoles ?? null,
    data.message,
  ];
  console.log("[persistBroadcast] values:", values);
  try {
    const result = await pool.query(
      `INSERT INTO chat_messages
         (sender_id, sender_name, sender_role, recipient_id, recipient_type, target_roles, message)
       VALUES ($1, $2, $3, NULL, $4, $5, $6)
       RETURNING *`,
      values
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
  const values = [session.userId, session.name, session.role, data.message];
  console.log("[persistUserMessage] values:", values);
  try {
    const result = await pool.query(
      `INSERT INTO chat_messages
         (sender_id, sender_name, sender_role, recipient_id, recipient_type, target_roles, message)
       VALUES ($1, $2, $3, NULL, 'single', NULL, $4)
       RETURNING *`,
      values
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

    // ✅ Disconnect if any required handshake field is missing or empty
    if (!isNonEmpty(userId) || !isNonEmpty(role) || !isNonEmpty(name)) {
      console.warn("[Socket] Rejected connection — missing handshake fields:", {
        userId,
        role,
        name,
      });
      return socket.disconnect();
    }

    const session = { userId, role, name };
    const isAdmin = role.toLowerCase().includes("admin");

    socket.join(userId);
    socket.join(`role:${role}`);
    if (isAdmin) socket.join(ADMIN_ROOM);

    console.log(`[Socket] Connected: userId=${userId} role=${role} name=${name}`);

    // ── Admin → single user ────────────────────────────────────
    socket.on("admin:message:single", async (data: AdminSingleDTO) => {
      if (!isAdmin) return;

      const validationError = validateAdminSingle(data);
      if (validationError) {
        console.warn(`[Socket] admin:message:single — ${validationError}:`, data);
        return socket.emit("admin:message:error", {
          _tempId: data._tempId,
          reason: validationError,
        });
      }

      const saved = await persistSingle(data);
      if (!saved) return socket.emit("admin:message:error", { _tempId: data._tempId });

      io.to(data.recipientId).emit("user:receive", saved);
      socket.emit("admin:message:sent", saved);
      emitConversationUpdated(io, saved, ADMIN_ROOM, data.recipientId);

      sendPushToUser(data.recipientId, {
        title: "Message from ORHC Admin",
        body: truncate(data.message),
        url: "/judge/dashboard",
      }).catch((err: unknown) =>
        console.error("[Push] admin:message:single failed:", err)
      );
    });

    // ── Admin → broadcast ──────────────────────────────────────
    socket.on("admin:message:broadcast", async (data: AdminBroadcastDTO) => {
      if (!isAdmin) return;

      const validationError = validateAdminBroadcast({ ...data, recipientType: "broadcast" });
      if (validationError) {
        console.warn(`[Socket] admin:message:broadcast — ${validationError}:`, data);
        return socket.emit("admin:message:error", {
          _tempId: data._tempId,
          reason: validationError,
        });
      }

      const saved = await persistBroadcast({ ...data, recipientType: "broadcast" });
      if (!saved) return socket.emit("admin:message:error", { _tempId: data._tempId });

      io.emit("broadcast:receive", saved);
      socket.emit("admin:message:sent", saved);
      emitConversationUpdated(io, saved, ADMIN_ROOM);
    });

    // ── Admin → group (role-based) ─────────────────────────────
    socket.on("admin:message:group", async (data: AdminBroadcastDTO) => {
      if (!isAdmin) return;

      const validationError = validateAdminBroadcast({ ...data, recipientType: "group" });
      if (validationError) {
        console.warn(`[Socket] admin:message:group — ${validationError}:`, data);
        return socket.emit("admin:message:error", {
          _tempId: data._tempId,
          reason: validationError,
        });
      }

      const saved = await persistBroadcast({ ...data, recipientType: "group" });
      if (!saved) return socket.emit("admin:message:error", { _tempId: data._tempId });

      if (saved.target_roles) {
        saved.target_roles.forEach((r) => io.to(`role:${r}`).emit("broadcast:receive", saved));
      }
      io.to(ADMIN_ROOM).emit("admin:receive", saved);
      socket.emit("admin:message:sent", saved);
      emitConversationUpdated(io, saved, ADMIN_ROOM);

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

    // ── User → Admin ───────────────────────────────────────────
    socket.on("user:message", async (data: UserMessageDTO) => {
      if (isAdmin) return;

      const validationError = validateUserMessage(session, data);
      if (validationError) {
        console.warn(`[Socket] user:message — ${validationError}:`, { session, data });
        return socket.emit("user:message:error", {
          _tempId: data._tempId,
          reason: validationError,
        });
      }

      const saved = await persistUserMessage(session, data);
      if (!saved) return socket.emit("user:message:error", { _tempId: data._tempId });

      io.to(ADMIN_ROOM).emit("admin:receive", saved);
      socket.emit("user:message:sent", saved);
      emitConversationUpdated(io, saved, ADMIN_ROOM, session.userId);

      sendPushToAdmins({
        title: `New message from ${session.name}`,
        body: truncate(data.message),
        url: "/superadmin/messages",
      }).catch((err: unknown) =>
        console.error("[Push] user:message push failed:", err)
      );
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: userId=${userId}`);
    });
  });

  return io;
};
