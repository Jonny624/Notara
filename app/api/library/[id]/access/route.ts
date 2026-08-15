import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return Response.json({ error: "Invalid library ID." }, { status: 400 });
  }

  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return Response.json({ error: "Access code is required." }, { status: 400 });
    }

    const db = await getDb();
    const deck = await db.collection("decks").findOne({ _id: new ObjectId(id) });

    if (!deck) {
      return Response.json({ error: "Library not found." }, { status: 404 });
    }
    if (deck.type !== "library") {
      return Response.json({ error: "Not a library." }, { status: 400 });
    }
    if (deck.accessCode !== code.trim()) {
      return Response.json({ error: "Incorrect access code." }, { status: 403 });
    }

    return Response.json({
      library: {
        id: deck._id.toString(),
        title: deck.title,
        description: deck.description ?? null,
        ownerUsername: deck.ownerUsername,
        cards: deck.cards,
        createdAt: deck.createdAt,
      },
    });
  } catch (err) {
    console.error("[POST /api/library/[id]/access]", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
