import { get, set, del } from 'idb-keyval';

const INDEX = 'parquet-go:index';
const ACTIVE = 'parquet-go:active';
const bufKey = (id: string) => `parquet-go:buf:${id}`;

export interface FileMeta {
    id: string;
    name: string;
}

export const listFiles = async (): Promise<FileMeta[]> => (await get(INDEX)) ?? [];
export const getActiveId = (): Promise<string | undefined> => get(ACTIVE);
export const getBuffer = (id: string): Promise<ArrayBuffer | undefined> => get(bufKey(id));
export const setActiveId = (id: string): Promise<void> => set(ACTIVE, id);

function uniqueName(name: string, taken: Set<string>): string {
    if (!taken.has(name)) {
        return name;
    }
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let n = 1;
    while (taken.has(`${base} (${n})${ext}`)) {
        n += 1;
    }
    return `${base} (${n})${ext}`;
}

export async function addFile(name: string, buffer: ArrayBuffer): Promise<FileMeta> {
    const index = await listFiles();
    const meta: FileMeta = { id: crypto.randomUUID(), name: uniqueName(name, new Set(index.map((f) => f.name))) };
    await set(bufKey(meta.id), buffer);
    await set(INDEX, [...index, meta]);
    await set(ACTIVE, meta.id);
    return meta;
}

export async function removeFile(id: string): Promise<FileMeta[]> {
    await del(bufKey(id));
    const remaining = (await listFiles()).filter((f) => f.id !== id);
    await set(INDEX, remaining);
    if ((await getActiveId()) === id) {
        await set(ACTIVE, remaining[0]?.id ?? '');
    }
    return remaining;
}

export async function renameFile(id: string, name: string): Promise<FileMeta[]> {
    const files = (await listFiles()).map((f) => (f.id === id ? { ...f, name } : f));
    await set(INDEX, files);
    return files;
}

export async function clearFiles(): Promise<void> {
    for (const f of await listFiles()) {
        await del(bufKey(f.id));
    }
    await del(INDEX);
    await del(ACTIVE);
}
