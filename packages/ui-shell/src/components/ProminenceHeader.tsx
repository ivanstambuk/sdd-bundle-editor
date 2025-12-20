interface ProminenceHeaderProps {
    /** The icon to display (emoji or character) */
    icon?: string;
    /** The title/label text */
    title: string;
    /** Optional description shown as tooltip on help icon */
    description?: string;
}

/**
 * ProminenceHeader - A visual header for hero/primary/secondary prominence fields.
 * Used in RJSF CustomFieldTemplate for fields with x-sdd-prominence schema hints.
 * 
 * Visual hierarchy levels:
 * - hero: Largest, most prominent (e.g., main problem statement)
 * - primary: Important section headers (e.g., Context, Decision)
 * - secondary: Standard field headers (default for most fields)
 * 
 * The visual styling is controlled via CSS classes (.rjsf-prominence-header).
 */
export function ProminenceHeader({ icon, title, description }: ProminenceHeaderProps) {
    return (
        <div className="rjsf-prominence-header">
            {icon && <span className="rjsf-prominence-icon">{icon}</span>}
            <span className="rjsf-prominence-title">{title}</span>
            {description && (
                <span className="field-help-icon" title={description}>
                    ⓘ
                </span>
            )}
        </div>
    );
}
