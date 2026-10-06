import { expect, test } from "bun:test";
import { extractPromptModel } from "../src/prompt-model.ts";
import { patchRuntimePromptModel } from "../scripts/sync-runtime.ts";

const model = "account:zai-start-plan/GLM-5.3-Flash";
const options = { prompt: "string", resume: "string" } as const;

test("extracts a per-prompt model while preserving prompt text and resume arguments", () => {
  expect(extractPromptModel(["--model", model, "-p", "ok", "--resume", "session"], options))
    .toEqual({ args: ["-p", "ok", "--resume", "session"], model });
  expect(extractPromptModel([`--model=${model}`, "--prompt=ok"], options))
    .toEqual({ args: ["--prompt=ok"], model });
  expect(extractPromptModel(["--prompt", "--model"], options))
    .toEqual({ args: ["--prompt", "--model"] });
  expect(() => extractPromptModel(["--model", "glm", "-p", "ok"], options)).toThrow(/provider\/model/);
  expect(() => extractPromptModel(["--model", model], options)).toThrow(/requires --prompt/);
  expect(() => extractPromptModel(["--model", model, "--model", model, "-p", "ok"], options)).toThrow(/only once/);
});

test("switches the restored app transiently before submitting a prompt and propagates invalid models", async () => {
  const source = 'async function run(app,options){let trace;if(trace=app.traceId,options.memoryBench)throw Error("unused");return app.submitPrompt("ok")}';
  const patched = patchRuntimePromptModel(source);
  expect(patchRuntimePromptModel(patched)).toBe(patched);
  expect(() => patchRuntimePromptModel("unsupported")).toThrow(/incompatible/);
  const load = (env: Record<string, string>) => new Function("process", `${patched};return run`)({ env });
  const events: unknown[] = [];
  const app = {
    traceId: "fixture", setModel: async (...args: unknown[]) => { events.push(args); },
    submitPrompt: async () => { events.push("prompt"); return "ok"; }
  };
  expect(await load({ ZCODE_CLI_PROMPT_MODEL: model })(app, {})).toBe("ok");
  expect(events).toEqual([[model, { transient: true }], "prompt"]);
  events.length = 0;
  await load({})(app, {});
  expect(events).toEqual(["prompt"]);
  events.length = 0;
  await expect(load({ ZCODE_CLI_PROMPT_MODEL: model })({ ...app,
    setModel: async () => { throw new Error("Unknown model"); }
  }, {})).rejects.toThrow("Unknown model");
  expect(events).toEqual([]);
});
