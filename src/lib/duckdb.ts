import * as duckdb from '@duckdb/duckdb-wasm';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import { aliasFor } from './alias';
import type { Row } from './types';

/**
 * Only the single-threaded bundles: the threaded one needs cross-origin isolation,
 * which a static host like GitHub Pages cannot grant. selectBundle picks the best
 * of these for the browser at hand. Queries still run off the main thread.
 */
const BUNDLES: duckdb.DuckDBBundles = {
    mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
    eh: { mainModule: ehWasm, mainWorker: ehWorker },
};

let pending: Promise<duckdb.AsyncDuckDB> | null = null;
let connecting: Promise<duckdb.AsyncDuckDBConnection> | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Boots the engine once, on whichever comes first: a prepare or a real read. */
function getDb(): Promise<duckdb.AsyncDuckDB> {
    if (!pending) {
        pending = (async () => {
            const bundle = await duckdb.selectBundle(BUNDLES);
            const worker = new Worker(bundle.mainWorker!);
            const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
            await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
            return db;
        })();
    }
    return pending;
}

/**
 * Starts the engine without waiting for it. The bundle is tens of megabytes to
 * fetch and compile, and none of it depends on the file, so the work can begin
 * before there is one. A file that arrives mid-boot awaits this same promise.
 */
export function prepareEngine(): void {
    void getDb().catch(() => undefined);
}

/**
 * One connection for the whole session — opening one per query cost more than the
 * queries did. Work is queued because a single connection cannot interleave.
 */
function connection(): Promise<duckdb.AsyncDuckDBConnection> {
    if (!connecting) {
        connecting = getDb().then((db) => db.connect());
    }
    return connecting;
}

function run<T>(work: (conn: duckdb.AsyncDuckDBConnection) => Promise<T>): Promise<T> {
    const next = queue.then(() => connection().then(work));
    queue = next.catch(() => undefined);
    return next;
}

/** Row identity for edits: assigned once at load and never reused. */
export const ROW_ID = '__rid';

interface LoadedTable {
    table: string;
    alias: string;
    columns: string[];
    rowCount: number;
}

const tableName = (id: string) => `t_${id.replace(/-/g, '')}`;

/** Column names a query would produce, and the cheapest way to find out if it is valid. */
export async function describeQuery(sql: string): Promise<string[]> {
    const described = await query(`DESCRIBE ${sql}`);
    return described.map((r) => String((r as { column_name: string }).column_name));
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

export async function loadTable(id: string, name: string, buffer: ArrayBuffer): Promise<LoadedTable> {
    const db = await getDb();
    const file = `${id}-${name}`;
    const table = tableName(id);

    // Registering transfers the buffer to the worker and detaches it, so hand over a
    // copy — the caller still needs the original to put in IndexedDB.
    await db.registerFileBuffer(file, new Uint8Array(buffer.slice(0)));
    return run(async (conn) => {
        await conn.query(`CREATE OR REPLACE TABLE ${ident(table)} AS
            SELECT (row_number() OVER () - 1)::BIGINT AS ${ident(ROW_ID)}, * FROM read_parquet(${literal(file)})`);
        const described = await conn.query(`DESCRIBE ${ident(table)}`);
        const columns = described.toArray()
            .map((r) => String((r as unknown as { column_name: string }).column_name))
            .filter((c) => c !== ROW_ID);
        const counted = await conn.query(`SELECT count(*)::BIGINT AS n FROM ${ident(table)}`);
        const rowCount = Number((counted.toArray()[0] as unknown as { n: bigint }).n);
        const alias = aliasFor(name);
        await conn.query(`CREATE OR REPLACE VIEW ${ident(alias)} AS SELECT * FROM ${ident(table)}`);
        return { table, alias, columns, rowCount };
    });
}

export async function dropTable(id: string): Promise<void> {
    if (!pending) {
        return;
    }
    await run((conn) => conn.query(`DROP TABLE IF EXISTS ${ident(tableName(id))} CASCADE`));
}

/** Arrow rows are lazy proxies; hand the grid plain objects it can hold on to. */
export function query(sql: string): Promise<Row[]> {
    return run(async (conn) => {
        const result = await conn.query(sql);
        return result.toArray().map((r) => ({ ...(r as unknown as Row) }));
    });
}

export async function queryScalar(sql: string): Promise<number> {
    const rows = await query(sql);
    const value = rows.length ? Object.values(rows[0])[0] : 0;
    return typeof value === 'bigint' ? Number(value) : Number(value ?? 0);
}

export async function execute(sql: string): Promise<void> {
    await run((conn) => conn.query(sql));
}

/** Runs the query straight into DuckDB's CSV writer and hands back the bytes. */
export async function exportQueryCsv(sql: string, header: boolean): Promise<Uint8Array> {
    const db = await getDb();
    const out = `export-${Date.now()}.csv`;
    await run((conn) => conn.query(`COPY (${sql}) TO ${literal(out)} (FORMAT CSV, HEADER ${header})`));
    const bytes = await db.copyFileToBuffer(out);
    await db.dropFile(out);
    return bytes;
}
