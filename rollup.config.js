import typescript from "rollup-plugin-typescript2";
// @ts-ignore
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { wasm } from "@rollup/plugin-wasm";
import json from "@rollup/plugin-json";

export default {
  input: "server/index.ts",
  output: {
    file: "server-dist/index.cjs",
    format: "cjs",
  },
  plugins: [commonjs(), typescript(), nodeResolve(), wasm(), json()],
};
