import { strings } from "@/lib/strings";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{strings.appName}</h1>
      <p className="text-sm text-muted">{strings.tagline}</p>
    </main>
  );
}
