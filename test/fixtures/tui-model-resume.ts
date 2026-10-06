#!/usr/bin/env bun

import { runTui } from "../../packages/zcode-tui/src/index.ts";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

let resumed = false;
const defaultModel = "scenario/glm-5.3";
const statePath = join(process.cwd(), ".model-resume-state.json");
const defaultModelPath = join(process.cwd(), ".default-model-state.json");

async function readModel(path: string): Promise<string> {
  try {
    const state = JSON.parse(await readFile(path, "utf8")) as { model?: unknown };
    return typeof state.model === "string" && state.model.trim() ? state.model : defaultModel;
  } catch {
    return defaultModel;
  }
}

async function saveSessionModel(model: string): Promise<{ model: string }> {
  await writeFile(statePath, JSON.stringify({ model }), "utf8");
  return { model };
}

await runTui({
  initialModel: await readModel(defaultModelPath),
  modelOptions: [
    { id: "scenario/kimi-k3", name: "Kimi K3" },
    { alias: "main", id: "scenario/glm-5.3", name: "GLM-5.3" },
    { id: "scenario/glm-5.3-flash", name: "GLM-5.3-Flash" }
  ],
  loadSessionTranscript: async () => [],
  readSessionModel: async () => resumed ? { model: await readModel(statePath) } : undefined,
  setTransientModel: saveSessionModel,
  readDefaultModel: () => readModel(defaultModelPath),
  setDefaultModel: async (modelId) => {
    await writeFile(defaultModelPath, JSON.stringify({ model: modelId }), "utf8");
    return await saveSessionModel(modelId);
  },
  submitPrompt: async (input) => input === "/resume fixture-session" && (resumed = true)
    ? {
        model: await readModel(defaultModelPath),
        resetSessionProjection: true,
        restoredMessages: [{
          messageId: "resumed_assistant",
          role: "agent",
          model: await readModel(statePath),
          content: "Restored response from the selected session model."
        }],
        response: "Resumed session fixture-session."
      }
    : { response: `Echo: ${String(input)}` },
  stdout: process.stdout,
  stderr: process.stderr,
  stdin: process.stdin
} as Parameters<typeof runTui>[0]);
