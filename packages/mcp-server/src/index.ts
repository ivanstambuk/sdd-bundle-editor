#!/usr/bin/env node
import { SddMcpServer } from "./server.js";
import { BundlesConfigFileSchema, BundleConfig } from "./types.js";
import path from "path";
import fs from "fs";
import yaml from "js-yaml";

/**
 * Parse command line arguments and determine bundle configuration.
 * 
 * Supported modes:
 * 1. Single path: node server.js /path/to/bundle
 * 2. Multiple paths: node server.js /bundle1 /bundle2 /bundle3
 * 3. Config file: node server.js --config /path/to/bundles.yaml
 * 4. No args: uses SDD_SAMPLE_BUNDLE_PATH env var or default path
 */
function parseArgs(): BundleConfig[] {
    const args = process.argv.slice(2);

    // Mode 3: Config file mode
    const configIndex = args.indexOf("--config");
    if (configIndex !== -1 && args[configIndex + 1]) {
        const configPath = path.resolve(args[configIndex + 1]);
        return loadConfigFile(configPath);
    }

    // Mode 1 & 2: Direct path(s) mode
    if (args.length > 0 && !args[0].startsWith("-")) {
        const usedIds = new Set<string>();
        return args.map((argPath, index) => {
            let baseId = path.basename(argPath);
            let id = baseId;
            let counter = 2;
            while (usedIds.has(id)) {
                id = `${baseId}-${counter}`;
                counter++;
            }
            usedIds.add(id);
            return {
                id,
                path: path.resolve(argPath),
            };
        });
    }

    // Mode 4: Fallback to environment variable or default
    const defaultPath = process.env.SDD_SAMPLE_BUNDLE_PATH || "/home/ivan/dev/sdd-sample-bundle";
    return [{
        id: path.basename(defaultPath),
        path: path.resolve(defaultPath),
    }];
}

/**
 * Load bundle configuration from a YAML file.
 */
function loadConfigFile(configPath: string): BundleConfig[] {
    if (!fs.existsSync(configPath)) {
        console.error(`Config file not found: ${configPath}`);
        process.exit(1);
    }

    try {
        const content = fs.readFileSync(configPath, "utf-8");
        const parsed = yaml.load(content);
        const validated = BundlesConfigFileSchema.parse(parsed);

        // Resolve relative paths based on config file location
        const configDir = path.dirname(configPath);
        return validated.bundles.map(b => ({
            ...b,
            path: path.isAbsolute(b.path) ? b.path : path.resolve(configDir, b.path),
        }));
    } catch (err) {
        console.error(`Failed to parse config file: ${configPath}`, err);
        process.exit(1);
    }
}

// Main entry point
const bundleConfigs = parseArgs();

console.error(`Loading ${bundleConfigs.length} bundle(s):`);
bundleConfigs.forEach(b => console.error(`  - ${b.id}: ${b.path}`));

const server = new SddMcpServer(bundleConfigs);
server.start().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
