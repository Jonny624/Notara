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
  const user = getUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "Invalid ID." }, { status: 400 });

  try {
    const db = await getDb();
    const deck = await db.collection("decks").findOne({ _id: new ObjectId(id), ownerId: user.sub });
    if (!deck) return Response.json({ error: "Not found." }, { status: 404 });

    return Response.json({
      id: deck._id.toString(),
      title: deck.title,
      description: deck.description ?? null,
      type: (deck.type as string) ?? "flashcard",
      visibility: (deck.visibility as string) ?? "public",
      hidden: (deck.hidden as boolean) ?? false,
      cards: deck.cards ?? [],
      sets: deck.sets ?? null,
    });
  } catch (err) {
    console.error("[GET /api/decks/[id]]", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "Invalid ID." }, { status: 400 });

  try {
    const db = await getDb();
    const result = await db.collection("decks").deleteOne({ _id: new ObjectId(id), ownerId: user.sub });
    if (result.deletedCount === 0) return Response.json({ error: "Not found." }, { status: 404 });
    return Response.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/decks/[id]]", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!ObjectId.isValid(id)) return Response.json({ error: "Invalid ID." }, { status: 400 });

  try {
    const { title, description, cards, sets, type, visibility, accessCode, hidden } = await req.json();

    if (!title || typeof title !== "string" || title.trim().length < 1) {
      return Response.json({ error: "Title is required." }, { status: 400 });
    }

    const deckType: "flashcard" | "library" = type === "library" ? "library" : "flashcard";
    const deckVisibility: "public" | "private" =
      deckType === "library" && visibility === "private" ? "private" : "public";

    const db = await getDb();

    // Verify ownership and fetch current doc (to keep existing accessCode if needed)
    const existing = await db
      .collection("decks")
      .findOne({ _id: new ObjectId(id), ownerId: user.sub });
    if (!existing) return Response.json({ error: "Not found." }, { status: 404 });

    // Resolve access code: use new one if provided, fall back to stored one
    const resolvedAccessCode =
      accessCode && typeof accessCode === "string" && accessCode.trim().length >= 4
        ? accessCode.trim()
        : (existing.accessCode as string | undefined);

    if (deckType === "library" && deckVisibility === "private") {
      if (!resolvedAccessCode) {
        return Response.json(
          { error: "Private libraries require an access code (min 4 characters)." },
          { status: 400 },
        );
      }
    }

    const setFields: Record<string, unknown> = {};
    const unsetFields: Record<string, string> = {};

    if (deckType === "library" && sets) {
      if (!Array.isArray(sets) || sets.length < 1) {
        return Response.json({ error: "At least one set is required." }, { status: 400 });
      }
      for (const set of sets) {
        if (!set.name?.trim()) {
          return Response.json({ error: "Each set must have a name." }, { status: 400 });
        }
        if (!Array.isArray(set.cards) || set.cards.length < 1) {
          return Response.json({ error: "Each set must have at least one card." }, { status: 400 });
        }
        for (const card of set.cards) {
          if (!card.question?.trim()) {
            return Response.json(
              { error: "Each card must have a question." },
              { status: 400 },
            );
          }
        }
      }

      const cleanSets = sets.map((s: { name: string; description?: string; cards: { question: string; answer: string }[] }) => ({
        name: s.name.trim(),
        ...(s.description?.trim() ? { description: s.description.trim() } : {}),
        cards: s.cards.map((c) => ({ question: c.question.trim(), answer: c.answer.trim() })),
      }));
      const flatCards = cleanSets.flatMap(
        (s: { name: string; description?: string; cards: { question: string; answer: string }[] }) => s.cards,
      );

      Object.assign(setFields, {
        title: title.trim(),
        description: description?.trim() || null,
        sets: cleanSets,
        cards: flatCards,
        type: deckType,
        visibility: deckVisibility,
        hidden: hidden === true,
      });
    } else {
      if (!Array.isArray(cards) || cards.length < 1) {
        return Response.json({ error: "At least one card is required." }, { status: 400 });
      }
      for (const card of cards) {
        if (!card.question?.trim()) {
          return Response.json(
            { error: "Each card must have a question." },
            { status: 400 },
          );
        }
      }

      Object.assign(setFields, {
        title: title.trim(),
        description: description?.trim() || null,
        cards: cards.map((c: { question: string; answer: string }) => ({
          question: c.question.trim(),
          answer: c.answer.trim(),
        })),
        sets: null,
        type: deckType,
        visibility: deckVisibility,
        hidden: hidden === true,
      });
    }

    if (deckVisibility === "private" && resolvedAccessCode) {
      setFields.accessCode = resolvedAccessCode;
    } else {
      unsetFields.accessCode = "";
    }

    const updateOp: Record<string, unknown> = { $set: setFields };
    if (Object.keys(unsetFields).length > 0) updateOp.$unset = unsetFields;

    await db.collection("decks").updateOne({ _id: new ObjectId(id) }, updateOp);

    return Response.json({ id, title: title.trim() });
  } catch (err) {
    console.error("[PUT /api/decks/[id]]", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
