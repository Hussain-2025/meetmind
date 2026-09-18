import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const parseCookies = (header?: string): Record<string, string> => {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
};

let io: Server | null = null;

export interface AvatarUpdatePayload {
  userId: string;
  avatar: string;
  avatarType: string;
  name: string;
  email: string;
}

const authenticateSocket = (socket: Socket): { id: string; role: string } | null => {
  try {
    const rawCookie = socket.handshake.headers.cookie;
    let token = "";

    if (rawCookie) {
      const cookies = parseCookies(rawCookie);
      token = cookies.accessToken || "";
    }

    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    if (!token && socket.handshake.headers.authorization) {
      token = socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "");
    }

    if (!token) return null;

    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string };
    return decoded;
  } catch {
    return null;
  }
};

export const initSocket = (httpServer: HttpServer): Server => {
  const allowedOrigins = (env.CLIENT_URL || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || env.NODE_ENV !== "production") {
          return callback(null, true);
        }
        const cleanOrigin = origin.replace(/\/+$/, "");
        if (allowedOrigins.includes("*") || allowedOrigins.includes(cleanOrigin) || allowedOrigins.length === 0) {
          return callback(null, true);
        }
        callback(null, origin);
      },
      credentials: true,
    },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    const user = authenticateSocket(socket);
    if (!user) {
      return next(new Error("Unauthorized"));
    }
    socket.data.userId = user.id;
    socket.data.role = user.role;
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on("disconnect", () => {
      socket.leave(`user:${userId}`);
    });
  });

  return io;
};

export const getIO = (): Server | null => io;

export const broadcastAvatarUpdate = (payload: AvatarUpdatePayload): void => {
  if (!io) return;
  io.emit("user:avatar:updated", payload);
};
