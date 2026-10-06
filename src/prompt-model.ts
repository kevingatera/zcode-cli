import { parseArgs } from "node:util";
import type { RuntimeCliOptionType } from "./runtime-capabilities.ts";

export function extractPromptModel(
  args: string[], optionTypes: Readonly<Record<string, RuntimeCliOptionType>>
): { args: string[]; model?: string } {
  const options = Object.fromEntries(Object.entries(optionTypes).map(([name, type]) => [name, { type }]));
  const parsed = parseArgs({ args, allowPositionals: true, strict: false, tokens: true,
    options: { ...options, prompt: { type: "string", short: "p" }, model: { type: "string" } } });
  const tokens = parsed.tokens.filter(token => token.kind === "option" && token.name === "model");
  if (tokens.length === 0) return { args };
  if (tokens.length !== 1) throw new Error("Specify --model only once.");
  if (typeof parsed.values.prompt !== "string") throw new Error("--model requires --prompt or -p.");
  const model = String(parsed.values.model).trim();
  if (!/^[^/\s]+\/\S+$/u.test(model)) throw new Error("--model must be a provider/model ID.");
  const token = tokens[0]!;
  const removed = new Set([token.index]);
  if (token.kind === "option" && !token.inlineValue) removed.add(token.index + 1);
  return { args: args.filter((_, index) => !removed.has(index)), model };
}
