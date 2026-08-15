export async function POST() {
  const headers = new Headers();
  headers.set("Set-Cookie", "notara_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
  return new Response(null, { status: 204, headers });
}
