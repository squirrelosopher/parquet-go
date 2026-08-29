/**
 * Cells arrive already rendered by the engine, which is what keeps them in step with
 * the expression the filter matches against. Only an absent value is decided here.
 */
export function formatCell(value: unknown): string {
    return value == null ? '' : String(value);
}
