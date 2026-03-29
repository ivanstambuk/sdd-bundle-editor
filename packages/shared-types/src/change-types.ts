export interface ProposedChange {
    entityId: string;
    entityType: string;
    fieldPath: string;
    originalValue: unknown;
    newValue: unknown;
    rationale?: string;
}
