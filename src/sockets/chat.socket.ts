import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import config from "../config/env";
import pool from "../config/db";

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
  _tempId?: string; // passed through from client, never stored in DB
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
       VALUES ($1, $2, $3, $4, $5, NULL, $6)
       RETURNING *`,
      [data.senderId, data.senderName, data.senderRole, data.recipientId, "single", data.message]
    );
    // Attach _tempId so the client can match & replace its optimistic entry
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
    // Route non-admin messages to the admin inbox (recipient_id = NULL, type = 'single')
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

// ── Socket server ─────────────────────────────────────────────

export const initSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: config.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const ADMIN_ROOM = "admin-support";

  io.on("connection", (socket: Socket) => {
    const { userId, role, name } = socket.handshake.query as {
      userId: string;
      role: string;
      name: string;
    };

    if (!userId || !role) {
      socket.disconnect();
      return;
    }

    const session = { userId, role, name };
    const isAdmin = role.toLowerCase().includes("admin");

    // Join personal + role rooms
    socket.join(userId);
    socket.join(`role:${role}`);
    if (isAdmin) socket.join(ADMIN_ROOM);

    console.log(`[Socket] ✅ ${name} (${role}) connected`);

    // ── Admin → single user ──────────────────────────────────
    socket.on("admin:message:single", async (data: AdminSingleDTO) => {
      if (!isAdmin) return; // security: only admins may use this event

      const saved = await persistSingle(data);

      if (!saved) {
        // Tell the sender their message failed; client removes the optimistic entry
        socket.emit("admin:message:error", { _tempId: data._tempId });
        return;
      }

      // Deliver to recipient's personal room
      io.to(data.recipientId).emit("user:receive", saved);

      // Echo the confirmed message (with DB id + _tempId) back to the SENDER only.
      // The _tempId lets the client swap out the optimistic bubble for the real one.
      // We emit to the sender's socket directly so only they receive this confirmation.
      socket.emit("admin:message:sent", saved);
    });

    // ── Admin → broadcast (everyone) ────────────────────────
    socket.on("admin:message:broadcast", async (data: AdminBroadcastDTO) => {
      if (!isAdmin) return;

      const saved = await persistBroadcast({ ...data, recipientType: "broadcast" });

      if (!saved) {
        socket.emit("admin:message:error", { _tempId: data._tempId });
        return;
      }

      // Broadcast to all connected sockets
      io.emit("user:receive", saved);

      // Confirm back to sender
      socket.emit("admin:message:sent", saved);
    });

    // ── Admin → group (specific roles) ───────────────────────
    socket.on("admin:message:group", async (data: AdminBroadcastDTO) => {
      if (!isAdmin) return;

      const saved = await persistBroadcast({ ...data, recipientType: "group" });

      if (!saved) {
        socket.emit("admin:message:error", { _tempId: data._tempId });
        return;
      }

      // Deliver to each targeted role room
      if (saved.target_roles) {
        saved.target_roles.forEach((r) => io.to(`role:${r}`).emit("user:receive", saved));
      }

      // Also fan out to admin room so all admins see it
      io.to(ADMIN_ROOM).emit("admin:receive", saved);

      // Confirm back to sender
      socket.emit("admin:message:sent", saved);
    });

    // ── Non-admin user → admin inbox ─────────────────────────
    socket.on("user:message", async (data: UserMessageDTO) => {
      if (isAdmin) return; // admins don't use this event

      const saved = await persistUserMessage(session, data);

      if (!saved) {
        socket.emit("user:message:error", { _tempId: data._tempId });
        return;
      }

      // Deliver to all admins
      io.to(ADMIN_ROOM).emit("admin:receive", saved);

      // Confirm back to sender with DB id + _tempId so they can replace optimistic
      socket.emit("user:message:sent", saved);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] ❌ ${name} disconnected`);
    });
  });

  return io;
};