import assert from "node:assert/strict";
import { test } from "node:test";
import { parseImport } from "../src/lib/import-words.ts";

test("imports mixed separators and skips empty or incomplete rows", () => {
  assert.deepEqual(parseImport("apple;jablko;[jídlo]\n\ninvalid\njourney\tcesta\ttravel\nlearn,učit se"), [
    { en: "apple", cz: "jablko", category: "jídlo" },
    { en: "journey", cz: "cesta", category: "travel" },
    { en: "learn", cz: "učit se", category: "" },
  ]);
});
test("reimports exported CSV without importing the header or quote marks", () => {
  assert.deepEqual(parseImport('en;cz;category\n"a journey";"cesta";"travel"\n"say ""hello""";"řekni ahoj";""'), [
    { en: "a journey", cz: "cesta", category: "travel" },
    { en: 'say "hello"', cz: "řekni ahoj", category: "" },
  ]);
});
test("ignores separators inside quotes and rejects unclosed quotes", () => {
  assert.deepEqual(parseImport('"hello; world",ahoj,test\n"broken;row'), [{en:"hello; world",cz:"ahoj",category:"test"}]);
});
