import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "@/lib/mongodb";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return Response.json({ error: "Username/email and password are required." }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection("users");

    const normalized = identifier.trim().toLowerCase();
    const user = await users.findOne({
      $or: [{ username: normalized }, { email: normalized }],
    });

    if (!user) {
      return Response.json({ error: "Invalid username/email or password." }, { status: 401 });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return Response.json({ error: "Invalid username/email or password." }, { status: 401 });
    }

    const token = jwt.sign(
      { sub: user._id.toString(), username: user.displayUsername },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    const res = Response.json({ username: user.displayUsername });
    const headers = new Headers(res.headers);
    headers.set(
      "Set-Cookie",
      `notara_token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`,
    );
    return new Response(res.body, { status: 200, headers });
  } catch (err) {
    console.error("[signin]", err);
    return Response.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
