import type { ScriptWriter } from "./types";

const MAX_CHARS = 400;

export class ExtractScriptWriter implements ScriptWriter {
  write(rawFact: string, name: string): string {
    const cleaned = rawFact.replace(/\s+/g, " ").trim();
    if (!cleaned) {
      return `${name} är en intressant plats längs vägen.`;
    }

    const sentences = cleaned
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    let script = "";
    for (const sentence of sentences.slice(0, 3)) {
      const next = script ? `${script} ${sentence}` : sentence;
      if (next.length > MAX_CHARS) break;
      script = next;
    }

    if (!script) {
      script = cleaned.slice(0, MAX_CHARS);
    }

    if (script.length > MAX_CHARS) {
      script = script.slice(0, MAX_CHARS - 1).trimEnd() + "…";
    }

    return script;
  }
}
