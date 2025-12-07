#!/usr/bin/env node
import { SddMcpServer } from "./server.js";
import path from "path";

const args = process.argv.slice(2);
const bundleDir = args[0] || path.join(process.cwd(), "examples/basic-bundle");

const server = new SddMcpServer(path.resolve(bundleDir));
server.start().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
