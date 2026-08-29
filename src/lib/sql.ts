import type { MRT_ColumnFiltersState, MRT_SortingState } from 'mantine-react-table';
import { ROW_ID } from './duckdb';

export const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
export const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

const BACKSLASH = String.fromCharCode(92);
const WILDCARD = new RegExp(`[${BACKSLASH}${BACKSLASH}%_]`);

/**
 * The one rendering of a value, used both to draw it and to match it, so that no type
 * can show one thing and be searched as another.
 *
 * Single precision is written out in full rather than at the width it is stored: DuckDB
 * would render FLOAT 9.083333015441895 as `9.083333`, which is the shortest decimal
 * that survives the round trip but not the whole of the value. The type is fixed per
 * column, so the planner settles the branch once rather than per row.
 */
const asText = (column: string) => {
    const id = ident(column);
    return `CASE WHEN typeof(${id}) = 'FLOAT' THEN CAST(CAST(${id} AS DOUBLE) AS VARCHAR) ELSE CAST(${id} AS VARCHAR) END`;
};

/**
 * Substring match against the displayed text, so it works on numbers and dates too.
 *
 * The UI's filters are plain substrings, so % and _ must lose their wildcard meaning.
 * An ESCAPE clause drops DuckDB off its fast LIKE path — roughly 4x on a full scan —
 * so it is only attached when the text actually contains something to escape.
 */
const containsText = (column: string, value: string) => {
    const cast = asText(column);
    if (!WILDCARD.test(value)) {
        return `${cast} ILIKE ${literal(`%${value}%`)}`;
    }
    const escaped = value.replace(new RegExp(`([${BACKSLASH}${BACKSLASH}%_])`, 'g'), `${BACKSLASH}$1`);
    return `${cast} ILIKE ${literal(`%${escaped}%`)} ESCAPE ${literal(BACKSLASH)}`;
};

const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * One number has many spellings, and text cannot see past the one on the page:
 * 9.083333 and 9.083333015441895 are the same float written at single and double
 * precision, as are 2475 and 2475.0. So a filter that reads as a number is also
 * compared as one, and finds the value it names however the column happens to store
 * it. TRY_CAST leaves anything that is not a number to the substring match alone.
 */
const contains = (column: string, value: string) => {
    const text = containsText(column, value);
    if (!NUMERIC.test(value)) {
        return text;
    }
    const asNumber = `TRY_CAST(${ident(column)} AS DOUBLE)`;
    return `(${text} OR ${asNumber} = TRY_CAST(${literal(value)} AS DOUBLE))`;
};

/** A view, expressed as the query it stands for. */
export interface QuerySpec {
    table: string;
    /** When set, the view reads from this query instead of the file's table. */
    sql: string;
    columns: string[];
    filters: MRT_ColumnFiltersState;
    search: string;
    sorting: MRT_SortingState;
}

/** A trailing semicolon is fine on its own but not once the query is a subquery. */
export const trimStatement = (sql: string | undefined) => (sql ?? '').trim().replace(/;+\s*$/, '');

/**
 * Filters, sorting and paging wrap the user's query rather than replacing it. The
 * alias gives ordering something to point at that is never an output column, so a
 * rendered column cannot be mistaken for the value it was rendered from.
 */
const SOURCE = 'src';

function source(spec: QuerySpec): string {
    const sql = trimStatement(spec.sql);
    return `${sql ? `(${sql})` : ident(spec.table)} AS ${ident(SOURCE)}`;
}

function where(spec: QuerySpec): string {
    const terms: string[] = [];
    for (const filter of spec.filters) {
        const value = String(filter.value ?? '').trim();
        if (value) {
            terms.push(contains(String(filter.id), value));
        }
    }
    const search = spec.search.trim();
    if (search && spec.columns.length) {
        terms.push(`(${spec.columns.map((c) => contains(c, search)).join(' OR ')})`);
    }
    return terms.length ? ` WHERE ${terms.join(' AND ')}` : '';
}

/**
 * Ties have to break somewhere, and left to itself the engine breaks them differently
 * each run: rows shuffle whenever the grid refetches, and one row can show up on two
 * pages while another shows up on none. The row id is unique, so ordering by it last
 * settles every tie and settles it the same way every time.
 *
 * A query brings no row id with it, and nothing else in a result set is guaranteed
 * unique, so a view reading from one keeps whatever order the engine gives it.
 */
function order(spec: QuerySpec): string {
    // Qualified, so a column rendered to text in the select list cannot capture the
    // name and turn a numeric ordering into an alphabetical one.
    const keys = spec.sorting.map((s) => `${ident(SOURCE)}.${ident(s.id)} ${s.desc ? 'DESC' : 'ASC'} NULLS LAST`);
    if (!trimStatement(spec.sql)) {
        keys.push(`${ident(SOURCE)}.${ident(ROW_ID)}`);
    }
    return keys.length ? ` ORDER BY ${keys.join(', ')}` : '';
}

/**
 * The grid draws text, so the engine renders it: what a cell shows is then the very
 * expression the filter matches against, for every type there is. Only the page on
 * screen is rendered, and only once filtering, ordering and paging have run against
 * the real types.
 */
export function pageSql(spec: QuerySpec, limit: number, offset: number): string {
    const shown = spec.columns.map((c) => `${asText(c)} AS ${ident(c)}`);
    // A user query carries no row id, so rows from one are not editable.
    const selected = trimStatement(spec.sql) ? shown : [ident(ROW_ID), ...shown];
    return `SELECT ${selected.join(', ')} FROM ${source(spec)}${where(spec)}${order(spec)} LIMIT ${limit} OFFSET ${offset}`;
}

export function countSql(spec: QuerySpec): string {
    return `SELECT count(*)::BIGINT AS n FROM ${source(spec)}${where(spec)}`;
}

/** Renamed columns are aliased, so the export carries the headers on screen. */
export function exportSql(spec: QuerySpec, labels: string[], limit?: number): string {
    const columns = spec.columns.map((c, i) => `${ident(c)} AS ${ident(labels[i] ?? c)}`).join(', ');
    const limited = limit ? ` LIMIT ${limit}` : '';
    return `SELECT ${columns} FROM ${source(spec)}${where(spec)}${order(spec)}${limited}`;
}

export function updateCellSql(table: string, rowId: number, column: string, value: string): string {
    return `UPDATE ${ident(table)} SET ${ident(column)} = ${literal(value)} WHERE ${ident(ROW_ID)} = ${rowId}`;
}
