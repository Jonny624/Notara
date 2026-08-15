import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
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

export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    const decks = await db
      .collection("decks")
      .find({ ownerId: user.sub })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({
      decks: decks.map((d) => ({
        id: d._id.toString(),
        title: d.title,
        description: d.description ?? null,
        cardCount: (d.cards as unknown[]).length,
        createdAt: d.createdAt,
        type: (d.type as string) ?? "flashcard",
        visibility: (d.visibility as string) ?? "public",
        hidden: (d.hidden as boolean) ?? false,
        setCount: d.sets ? (d.sets as unknown[]).length : undefined,
        setNames: d.sets ? (d.sets as { name: string }[]).map((s) => s.name) : undefined,
        accessCode: d.visibility === "private" && typeof d.accessCode === "string" ? d.accessCode : undefined,
      })),
    });
  } catch (err) {
    console.error("[GET /api/decks]", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { title, description, cards, sets, type, visibility, accessCode, hidden } = await req.json();

    if (!title || typeof title !== "string" || title.trim().length < 1) {
      return Response.json({ error: "Title is required." }, { status: 400 });
    }

    const deckType: "flashcard" | "library" = type === "library" ? "library" : "flashcard";
    const deckVisibility: "public" | "private" =
      deckType === "library" && visibility === "private" ? "private" : "public";

    if (deckType === "library" && deckVisibility === "private") {
      if (!accessCode || typeof accessCode !== "string" || accessCode.trim().length < 4) {
        return Response.json(
          { error: "Private libraries require an access code (min 4 characters)." },
          { status: 400 },
        );
      }
    }

    const db = await getDb();

    // Libraries use sets; flashcards use a flat cards array
    if (deckType === "library" && sets) {
      if (!Array.isArray(sets) || sets.length < 1) {
        return Response.json({ error: "At least one set is required." }, { status: 400 });
      }
      for (const set of sets) {
        if (!set.name?.trim()) {
          return Response.json({ error: "Each set must have a name." }, { status: 400 });
        }
        if (!Array.isArray(set.cards) || set.cards.length < 1) {
          return Response.json(
            { error: "Each set must have at least one card." },
            { status: 400 },
          );
        }
        for (const card of set.cards) {
          if (!card.question?.trim() || !card.answer?.trim()) {
            return Response.json(
              { error: "Each card must have a question and an answer." },
              { status: 400 },
            );
          }
        }
      }

      const cleanSets = sets.map((s: { name: string; cards: { question: string; answer: string }[] }) => ({
        name: s.name.trim(),
        cards: s.cards.map((c) => ({ question: c.question.trim(), answer: c.answer.trim() })),
      }));
      const flatCards = cleanSets.flatMap((s: { name: string; cards: { question: string; answer: string }[] }) => s.cards);

      const result = await db.collection("decks").insertOne({
        title: title.trim(),
        description: description?.trim() || null,
        ownerId: user.sub,
        ownerUsername: user.username,
        sets: cleanSets,
        cards: flatCards,
        type: deckType,
        visibility: deckVisibility,
        hidden: hidden === true,
        ...(deckVisibility === "private" ? { accessCode: (accessCode as string).trim() } : {}),
        createdAt: new Date(),
      });

      return Response.json(
        { id: result.insertedId.toString(), title: title.trim() },
        { status: 201 },
      );
    }

    // Flat cards (flashcard or legacy library)
    if (!Array.isArray(cards) || cards.length < 1) {
      return Response.json({ error: "At least one card is required." }, { status: 400 });
    }
    for (const card of cards) {
      if (!card.question?.trim() || !card.answer?.trim()) {
        return Response.json(
          { error: "Each card must have a question and an answer." },
          { status: 400 },
        );
      }
    }

    const result = await db.collection("decks").insertOne({
      title: title.trim(),
      description: description?.trim() || null,
      ownerId: user.sub,
      ownerUsername: user.username,
      cards: cards.map((c: { question: string; answer: string }) => ({
        question: c.question.trim(),
        answer: c.answer.trim(),
      })),
      type: deckType,
      visibility: deckVisibility,
      hidden: hidden === true,
      ...(deckType === "library" && deckVisibility === "private"
        ? { accessCode: (accessCode as string).trim() }
        : {}),
      createdAt: new Date(),
    });

    return Response.json(
      { id: result.insertedId.toString(), title: title.trim() },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/decks]", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
