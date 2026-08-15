import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "@/lib/mongodb";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();

    if (!username || typeof username !== "string" || username.trim().length < 2) {
      return Response.json({ error: "Username must be at least 2 characters." }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Invalid email address." }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection("users");

    const normalizedUsername = username.trim().toLowerCase();
    const existing = await users.findOne({
      $or: [
        { username: normalizedUsername },
        ...(email ? [{ email: email.trim().toLowerCase() }] : []),
      ],
    });
    if (existing) {
      const field = existing.username === normalizedUsername ? "Username" : "Email";
      return Response.json({ error: `${field} is already taken.` }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await users.insertOne({
      username: normalizedUsername,
      displayUsername: username.trim(),
      email: email ? email.trim().toLowerCase() : null,
      passwordHash,
      createdAt: new Date(),
    });

    const token = jwt.sign(
      { sub: result.insertedId.toString(), username: username.trim() },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    const res = Response.json({ username: username.trim() }, { status: 201 });
    // Set HttpOnly cookie so JS can't steal the token
    const headers = new Headers(res.headers);
    headers.set(
      "Set-Cookie",
      `notara_token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`,
    );
    return new Response(res.body, { status: 201, headers });
  } catch (err) {
    console.error("[signup]", err);
    return Response.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
