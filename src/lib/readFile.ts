import { parquetReadObjects, parquetMetadataAsync } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import Papa from 'papaparse';
import type { Dataset, Row } from './types';

export async function readFile(file: File): Promise<Dataset> {
    return parseBuffer(file.name, await file.arrayBuffer());
}

export function parseBuffer(name: string, buffer: ArrayBuffer): Promise<Dataset> {
    const ext = name.split('.').pop()?.toLowerCase();
    return ext === 'parquet' || ext === 'pq' ? parseParquet(name, buffer) : parseCsv(name, buffer);
}

async function parseParquet(name: string, buffer: ArrayBuffer): Promise<Dataset> {
    const metadata = await parquetMetadataAsync(buffer);
    const columns = metadata.schema.filter((s) => s.type != null).map((s) => s.name);
    const rows = (await parquetReadObjects({ file: buffer, metadata, compressors })) as Row[];
    return { name, columns, rows };
}

function parseCsv(name: string, buffer: ArrayBuffer): Promise<Dataset> {
    return new Promise((resolve, reject) => {
        Papa.parse<Row>(new File([buffer], name), {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (result) => resolve({ name, columns: result.meta.fields ?? [], rows: result.data }),
            error: reject,
        });
    });
}
