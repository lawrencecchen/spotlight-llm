import { defineConfig } from "tsup";

const matchAnything = new RegExp(".*");

export default defineConfig({
  entry: ["./server/index.ts"],
  noExternal: [],
  external: [],
});
