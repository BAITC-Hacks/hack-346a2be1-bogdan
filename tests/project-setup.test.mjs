import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredEnvNames = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

test("Git-safe env template contains every required variable", async () => {
  const example = await readFile(".env.example", "utf8");

  for (const name of requiredEnvNames) {
    assert.match(example, new RegExp(`^${name}=$`, "m"));
  }
});

test("local secrets are ignored while the env template is allowed", async () => {
  const gitignore = await readFile(".gitignore", "utf8");

  assert.match(gitignore, /^\.env\.local$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});
