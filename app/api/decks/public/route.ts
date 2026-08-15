import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();
    const decks = await db
      .collection("decks")
      .find({ hidden: { $ne: true } })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({
      decks: decks.map((d) => {
        const sets = (d.sets as { name: string }[] | null) ?? null;
        return {
          id: d._id.toString(),
          title: d.title,
          description: d.description ?? null,
          cardCount: (d.cards as unknown[]).length,
          ownerUsername: d.ownerUsername ?? null,
          createdAt: d.createdAt,
          type: (d.type as string) ?? "flashcard",
          visibility: (d.visibility as string) ?? "public",
          setNames: sets ? sets.map((s) => s.name) : undefined,
          hasCode: d.type === "library" && typeof d.accessCode === "string" && d.accessCode.length > 0,
        };
      }),
    });
  } catch (err) {
    console.error("[GET /api/decks/public]", err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
