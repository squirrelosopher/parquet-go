import type { MRT_ColumnFiltersState, MRT_SortingState } from 'mantine-react-table';
import { ROW_ID } from './duckdb';

export const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
export const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

const BACKSLASH = String.fromCharCode(92);
const WILDCARD = new RegExp(`[${BACKSLASH}${BACKSLASH}%_]`);
const SOURCE = 'src';

const asText = (column: string) => {
    const id = ident(column);
    return `CASE WHEN typeof(${id}) = 'FLOAT' THEN CAST(CAST(${id} AS DOUBLE) AS VARCHAR) ELSE CAST(${id} AS VARCHAR) END`;
};

const renderedColumn = (column: string) => `${asText(column)} AS ${ident(column)}`;

/**
 * Cast first: a substring match should work on numbers and dates too.
 *
 * The UI's filters are plain substrings, so % and _ must lose their wildcard meaning.
 * An ESCAPE clause drops DuckDB off its fast LIKE path — roughly 4x on a full scan —
 * so it is only attached when the text actually contains something to escape.
 */
const matchesText = (column: string, value: string) => {
    const cast = asText(column);
    if (!WILDCARD.test(value)) {
        return `${cast} ILIKE ${literal(`%${value}%`)}`;
    }
    const escaped = value.replace(new RegExp(`([${BACKSLASH}${BACKSLASH}%_])`, 'g'), `${BACKSLASH}$1`);
    return `${cast} ILIKE ${literal(`%${escaped}%`)} ESCAPE ${literal(BACKSLASH)}`;
};

const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

const matchesNumber = (column: string, value: string) =>
    `TRY_CAST(${ident(column)} AS DOUBLE) = TRY_CAST(${literal(value)} AS DOUBLE)`;

const matches = (column: string, value: string) => {
    const text = matchesText(column, value);
    return NUMERIC.test(value) ? `(${text} OR ${matchesNumber(column, value)})` : text;
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

/** Filters, sorting and paging wrap the user's query rather than replacing it. */
function source(spec: QuerySpec): string {
    const sql = trimStatement(spec.sql);
    return `${sql ? `(${sql})` : ident(spec.table)} AS ${ident(SOURCE)}`;
}

function where(spec: QuerySpec): string {
    const terms: string[] = [];
    for (const filter of spec.filters) {
        const value = String(filter.value ?? '').trim();
        if (value) {
            terms.push(matches(String(filter.id), value));
        }
    }
    const search = spec.search.trim();
    if (search && spec.columns.length) {
        terms.push(`(${spec.columns.map((c) => matches(c, search)).join(' OR ')})`);
    }
    return terms.length ? ` WHERE ${terms.join(' AND ')}` : '';
}

function order(spec: QuerySpec): string {
    const keys = spec.sorting.map((s) => `${ident(SOURCE)}.${ident(s.id)} ${s.desc ? 'DESC' : 'ASC'} NULLS LAST`);
    if (!trimStatement(spec.sql)) {
        keys.push(`${ident(SOURCE)}.${ident(ROW_ID)}`);
    }
    return keys.length ? ` ORDER BY ${keys.join(', ')}` : '';
}

export function pageSql(spec: QuerySpec, limit: number, offset: number): string {
    const shown = spec.columns.map(renderedColumn);
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

export function cellSql(table: string, rowId: number, column: string): string {
    return `SELECT ${renderedColumn(column)} FROM ${ident(table)} WHERE ${ident(ROW_ID)} = ${rowId}`;
}
