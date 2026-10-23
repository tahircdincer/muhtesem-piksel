import { readFile } from "node:fs/promises";
import path from "node:path";
import { strings } from "@/lib/strings";

// Checked in this order. The first one that exists wins.
const CANDIDATES: ReadonlyArray<{ name: string; type: string }> = [
  { name: "sehzademustafa.png", type: "image/png" },
  { name: "sehzademustafa.jpeg", type: "image/jpeg" },
  { name: "sehzademustafa.jpg", type: "image/jpeg" },
];

export async function GET(): Promise<Response> {
  const root = process.cwd();
  for (const { name, type } of CANDIDATES) {
    try {
      const bytes = await readFile(path.join(root, name));
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": type,
          "Cache-Control": "no-store",
          "X-Target-File": name,
        },
      });
    } catch {
      // Not found (or unreadable): try the next name.
    }
  }
  return Response.json({ error: strings.targetMissing }, { status: 404 });
}
