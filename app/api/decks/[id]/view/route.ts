import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

const JWT_SECRET = process.env.JWT_SECRET!;

function getUser(req: NextRequest): { sub: string; username: string } | null {
  const token = req.cookies.get("notara_token")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; username: string };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "Invalid ID." }, { status: 400 });

  const user = getUser(req);
  const accessCode = req.nextUrl.searchParams.get("code") ?? "";

  try {
    const db = await getDb();
    const deck = await db.collection("decks").findOne({ _id: new ObjectId(id) });
    if (!deck) return Response.json({ error: "Not found." }, { status: 404 });

    const isOwner = !!(user && deck.ownerId === user.sub);
    const isPublic = deck.visibility === "public";

    if (!isPublic) {
      if (!accessCode || accessCode !== deck.accessCode) {
        return Response.json({ error: "Access code required.", needsCode: true }, { status: 403 });
      }
    }

    return Response.json({
      id: deck._id.toString(),
      title: deck.title,
      description: deck.description ?? null,
      type: (deck.type as string) ?? "flashcard",
      visibility: (deck.visibility as string) ?? "public",
      cards: deck.cards ?? [],
      sets: deck.sets ?? null,
      ownerUsername: deck.ownerUsername ?? null,
      isOwner,
    });
  } catch (err) {
    console.error("[GET /api/decks/[id]/view]", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
