#!/usr/bin/env node
import { SddMcpServer } from "./server.js";
import path from "path";

const args = process.argv.slice(2);
// Use command line arg, or environment variable, or default to external bundle
const bundleDir = args[0] || process.env.SDD_SAMPLE_BUNDLE_PATH || "/home/ivan/dev/sdd-sample-bundle";

const server = new SddMcpServer(path.resolve(bundleDir));
server.start().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
