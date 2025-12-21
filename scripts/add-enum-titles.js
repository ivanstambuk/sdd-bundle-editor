#!/usr/bin/env node
/**
 * Script to add x-sdd-enumTitles to all enum fields in schema files.
 * This generates human-readable titles from enum values.
 */

const fs = require('fs');
const path = require('path');

const schemasDir = '/home/ivan/dev/sdd-sample-bundle/schemas';

// Humanize a value like "user-experience" -> "User Experience"
function humanize(value) {
    return value
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Custom title overrides for specific values that need special handling
const customTitles = {
    // ADR
    'superseded': 'Superseded',
    // Constraint severity
    'must': 'Must',
    'should': 'Should',
    'may': 'May',
    // Component kinds
    'ui': 'UI',
    'external_system': 'External System',
    // DataSchema
    'json-schema': 'JSON Schema',
    'xsd': 'XSD',
    'problem_details': 'Problem Details',
    'telemetry_payload': 'Telemetry Payload',
    // Protocol
    'http-rest': 'HTTP REST',
    'graphql': 'GraphQL',
    'grpc': 'gRPC',
    'cli': 'CLI',
    'mTLS': 'mTLS',
    'oauth2': 'OAuth2',
    'api-key': 'API Key',
    'bearer-token': 'Bearer Token',
    // Requirement
    'non-functional': 'Non-Functional',
    'user-experience': 'User Experience',
    'design-constraint': 'Design Constraint',
    // Threat (STRIDE)
    'information_disclosure': 'Information Disclosure',
    'denial_of_service': 'Denial of Service',
    'elevation_of_privilege': 'Elevation of Privilege',
    // TelemetrySchema
    'otel-http': 'OTEL HTTP',
    'otel-db': 'OTEL DB',
    'otel-messaging': 'OTEL Messaging',
    'otel-rpc': 'OTEL RPC',
    'otel-general': 'OTEL General',
    // Scenario
    'e2e-test': 'E2E Test',
    'perf-test': 'Performance Test',
    // Viewpoint
    'plantuml-component': 'PlantUML Component',
    'plantuml-sequence': 'PlantUML Sequence',
    'plantuml-class': 'PlantUML Class',
    'plantuml-activity': 'PlantUML Activity',
    // Fixture
    'mock-service': 'Mock Service',
    'external-system-harness': 'External System Harness',
    // Policy
    'data-retention': 'Data Retention',
    'api-design': 'API Design',
    // General
    'in-progress': 'In Progress',
};

function getTitle(value) {
    return customTitles[value] || humanize(value);
}

// Process a single schema file
function processSchema(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let schema;
    try {
        schema = JSON.parse(content);
    } catch (e) {
        console.error(`Error parsing ${filePath}: ${e.message}`);
        return false;
    }

    let modified = false;

    // Process top-level properties
    if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
            if (propSchema.enum && Array.isArray(propSchema.enum)) {
                // Check if it already has enumTitles
                if (!propSchema['x-sdd-enumTitles']) {
                    propSchema['x-sdd-enumTitles'] = {};
                    for (const enumValue of propSchema.enum) {
                        propSchema['x-sdd-enumTitles'][enumValue] = getTitle(enumValue);
                    }
                    modified = true;
                    console.log(`  Added enumTitles to ${propName}: ${propSchema.enum.join(', ')}`);
                }
            }
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(schema, null, 2) + '\n', 'utf8');
        return true;
    }
    return false;
}

// Main
const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.schema.json'));
console.log(`Processing ${files.length} schema files...\n`);

let modifiedCount = 0;
for (const file of files) {
    const filePath = path.join(schemasDir, file);
    console.log(`Processing ${file}...`);
    if (processSchema(filePath)) {
        modifiedCount++;
    }
}

console.log(`\nDone! Modified ${modifiedCount} files.`);
