import jwt from "jsonwebtoken";

const WS_JWT_SECRET = process.env.WS_JWT_SECRET || "dev-ws-secret";

export interface TokenPayload {
  userId: string;
  email: string;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, WS_JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
