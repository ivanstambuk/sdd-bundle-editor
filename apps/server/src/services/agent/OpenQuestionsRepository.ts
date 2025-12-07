import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AgentDecision, DecisionOption } from '@sdd-bundle-editor/core-ai';

interface OpenQuestionsTable {
    headers: string[];
    rows: string[][];
}

const TABLE_HEADERS = ['ID', 'Owner', 'Question', 'Options (A preferred)', 'Status', 'Asked', 'Notes'];

export class OpenQuestionsRepository {
    private filePath: string;

    constructor(bundleDir: string) {
        this.filePath = path.join(bundleDir, 'OPEN_QUESTIONS.md');
    }

    private async ensureFileExists(): Promise<void> {
        try {
            await fs.access(this.filePath);
        } catch {
            const initialContent = `# Open Questions

Use this file **only** to capture currently open medium- or high-impact questions.

| ID | Owner | Question | Options (A preferred) | Status | Asked | Notes |
|----|-------|----------|------------------------|--------|-------|-------|
`;
            await fs.writeFile(this.filePath, initialContent, 'utf-8');
        }
    }

    async addQuestion(decision: AgentDecision): Promise<void> {
        await this.ensureFileExists();
        let content = await fs.readFile(this.filePath, 'utf-8');

        // Simple append for now
        // Format options: "A: ...; B: ..."
        const optionsStr = decision.options.map(o => `${o.label}: ${o.description}`).join('; ');
        const row = `| ${decision.id} | Agent | ${decision.question} | ${optionsStr} | Open | ${new Date().toISOString().split('T')[0]} | ${decision.context || ''} |`;

        // Append row to the end of the table (assuming table is at the end or we just append to file)
        if (!content.endsWith('\n')) content += '\n';
        content += row + '\n';

        await fs.writeFile(this.filePath, content, 'utf-8');
    }

    async resolveQuestion(id: string, outcome: string): Promise<void> {
        // Simple implementation: read file, replace "Open" with "Resolved" in the matching row
        // In a real implementation we would parse the markdown properly.
        await this.ensureFileExists();
        let content = await fs.readFile(this.filePath, 'utf-8');

        const lines = content.split('\n');
        const updatedLines = lines.map(line => {
            if (line.includes(`| ${id} |`)) {
                // Determine which column is status. 
                // Currently hacking string replacement for simplicity in this phase
                return line.replace('| Open |', '| Resolved |') + ` <!-- Outcome: ${outcome} -->`;
            }
            return line;
        });

        await fs.writeFile(this.filePath, updatedLines.join('\n'), 'utf-8');
    }
}
