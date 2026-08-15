import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("notara_token")?.value;
  if (!token) return Response.json({ user: null });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { username: string };
    return Response.json({ user: { username: payload.username } });
  } catch {
    return Response.json({ user: null });
  }
}
