import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Center, Stack, Title, Text, Modal, Button, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Check, TriangleAlert } from 'lucide-react';
import { Header } from './components/Header';
import { FileDrop } from './components/FileDrop';
import { TableSkeleton } from './components/TableSkeleton';
import { DataTable } from './components/DataTable';
import { Sidebar } from './components/Sidebar';
import { ViewTabs } from './components/ViewTabs';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ExportRowsDialog, type ExportRowsOptions } from './components/ExportRowsDialog';
import { loadDataset } from './lib/readFile';
import { listFiles, getActiveId, getBuffer, addFile, clearFiles, renameFile as renameStored, setActiveId as persistActive, removeFile as removeStored, duplicateFile as duplicateStored, getViews, setViews, type FileMeta } from './lib/store';
import { dropTable, exportQueryCsv } from './lib/duckdb';
import { exportSql } from './lib/sql';
import { downloadCsv } from './lib/exportCsv';
import { createViewState, DEFAULT_VIEW_NAME, hasFilters, type View, type ViewState } from './lib/views';
import type { Dataset } from './lib/types';

const SIDEBAR_WIDTH = 280;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
const getRoute = (): 'home' | 'view' => (window.location.hash.replace(/^#\/?/, '') === 'view' ? 'view' : 'home');

const whenIdle = () => new Promise<void>((resolve) => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    ric ? ric(() => resolve(), { timeout: 400 }) : setTimeout(resolve, 150);
});

/** Views, their state and each file's selected tab, kept together so edits stay atomic. */
interface ViewsModel {
    views: View[];
    states: Record<string, ViewState>;
    activeByFile: Record<string, string>;
}

const EMPTY_VIEWS: ViewsModel = { views: [], states: {}, activeByFile: {} };

/** Views queued for closing, plus the subset whose filters the user would lose. */
interface CloseRequest {
    targets: View[];
    filtered: View[];
}

function closeMessage({ targets, filtered }: CloseRequest): string {
    if (targets.length === 1) {
        return `“${targets[0].name}” has filters applied. Close it and discard them?`;
    }
    const subject = filtered.length === 1 ? '1 of them has filters' : `${filtered.length} of them have filters`;
    return `Closing ${targets.length} views — ${subject} applied. Close them and discard the filters?`;
}

const pick = <T,>(source: Record<string, T>, keep: (key: string) => boolean): Record<string, T> =>
    Object.fromEntries(Object.entries(source).filter(([key]) => keep(key)));

export function App() {
    const [files, setFiles] = useState<FileMeta[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [dataset, setDataset] = useState<Dataset | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [route, setRoute] = useState(getRoute);
    const [promptFile, setPromptFile] = useState<File | null>(null);
    const [model, setModel] = useState<ViewsModel>(EMPTY_VIEWS);
    const [closeTarget, setCloseTarget] = useState<CloseRequest | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [hydrated, setHydrated] = useState(false);
    const booted = useRef(false);
    const restoring = useRef<Promise<void> | null>(null);
    const exportRef = useRef<((options: ExportRowsOptions) => void) | null>(null);

    const fileViews = model.views.filter((v) => v.fileId === activeId);
    const preferredViewId = activeId ? model.activeByFile[activeId] : undefined;
    const activeView = fileViews.find((v) => v.id === preferredViewId) ?? fileViews[0] ?? null;
    const activeViewId = activeView?.id ?? null;
    const activeViewState = activeViewId ? model.states[activeViewId] : undefined;

    // Restore first, so a file loading in parallel cannot create a duplicate "View 1"
    // before the stored tabs arrive. Declared ahead of the boot effect that awaits it.
    useEffect(() => {
        restoring.current = (async () => {
            const stored = await getViews<ViewsModel>();
            if (stored) {
                setModel((m) => {
                    const have = new Set(m.views.map((v) => v.fileId));
                    const views = [...m.views, ...stored.views.filter((v) => !have.has(v.fileId))];
                    const ids = new Set(views.map((v) => v.id));
                    return {
                        views,
                        states: { ...pick(stored.states, (id) => ids.has(id)), ...m.states },
                        activeByFile: { ...pick(stored.activeByFile, (f) => !have.has(f)), ...m.activeByFile },
                    };
                });
            }
            setHydrated(true);
        })();
    }, []);

    useEffect(() => {
        if (!hydrated) {
            return;
        }
        // Column resizing fires continuously; coalesce before touching IndexedDB.
        const timer = window.setTimeout(() => void setViews(model), 300);
        return () => window.clearTimeout(timer);
    }, [model, hydrated]);

    /** Every file needs one view; create it, or repair what a restore left incomplete. */
    const ensureView = (fileId: string, columns: string[]) =>
        setModel((m) => {
            const existing = m.views.filter((v) => v.fileId === fileId);
            if (existing.length) {
                const missing = existing.filter((v) => !m.states[v.id]);
                if (!missing.length && m.activeByFile[fileId]) {
                    return m;
                }
                const states = { ...m.states };
                for (const v of missing) {
                    states[v.id] = createViewState(columns);
                }
                return { ...m, states, activeByFile: { ...m.activeByFile, [fileId]: m.activeByFile[fileId] ?? existing[0].id } };
            }
            const view: View = { id: crypto.randomUUID(), fileId, name: DEFAULT_VIEW_NAME };
            return {
                views: [...m.views, view],
                states: { ...m.states, [view.id]: createViewState(columns) },
                activeByFile: { ...m.activeByFile, [fileId]: view.id },
            };
        });

    const addView = () =>
        setModel((m) => {
            if (!activeId || !dataset) {
                return m;
            }
            const view: View = { id: crypto.randomUUID(), fileId: activeId, name: DEFAULT_VIEW_NAME };
            return {
                views: [...m.views, view],
                states: { ...m.states, [view.id]: createViewState(dataset.columns) },
                activeByFile: { ...m.activeByFile, [activeId]: view.id },
            };
        });

    const selectView = (view: View) =>
        setModel((m) => ({ ...m, activeByFile: { ...m.activeByFile, [view.fileId]: view.id } }));

    const renameView = (view: View, name: string) =>
        setModel((m) => ({ ...m, views: m.views.map((v) => (v.id === view.id ? { ...v, name } : v)) }));

    const closeViews = (targets: View[]) => {
        if (!targets.length) {
            return;
        }
        const doomed = new Set(targets.map((v) => v.id));
        setModel((m) => {
            const views = m.views.filter((v) => !doomed.has(v.id));
            const states = pick(m.states, (id) => !doomed.has(id));
            const activeByFile = { ...m.activeByFile };
            for (const fileId of new Set(targets.map((v) => v.fileId))) {
                if (doomed.has(activeByFile[fileId])) {
                    const fallback = views.find((v) => v.fileId === fileId);
                    if (fallback) {
                        activeByFile[fileId] = fallback.id;
                    } else {
                        delete activeByFile[fileId];
                    }
                }
            }
            // Closing every view is allowed: the file drops back to an empty state and
            // picking it in the sidebar opens a fresh view.
            return { views, states, activeByFile };
        });
    };

    /** Only filtered views are worth a prompt; anything else closes straight away. */
    const requestClose = (targets: View[]) => {
        const filtered = targets.filter((v) => hasFilters(model.states[v.id]));
        if (filtered.length) {
            setCloseTarget({ targets, filtered });
        } else {
            closeViews(targets);
        }
    };

    const closeToTheLeft = (view: View) =>
        requestClose(fileViews.slice(0, fileViews.findIndex((v) => v.id === view.id)));

    const closeAllExcept = (view: View) => requestClose(fileViews.filter((v) => v.id !== view.id));

    const updateViewState = useCallback(
        (viewId: string) => (update: (previous: ViewState) => ViewState) =>
            setModel((m) => (m.states[viewId] ? { ...m, states: { ...m.states, [viewId]: update(m.states[viewId]) } } : m)),
        [],
    );

    useEffect(() => {
        const onHash = () => setRoute(getRoute());
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    const loadActive = async (meta: FileMeta) => {
        setDataset(null);
        const buffer = await getBuffer(meta.id);
        if (buffer) {
            const loaded = await loadDataset(meta.id, meta.name, buffer);
            await restoring.current;
            setDataset(loaded);
            ensureView(meta.id, loaded.columns);
        }
    };

    useEffect(() => {
        if (route !== 'view' || booted.current) {
            return;
        }
        booted.current = true;
        (async () => {
            const index = await listFiles();
            if (!index.length) {
                booted.current = false;
                window.location.hash = '';
                return;
            }
            setFiles(index);
            const activeStored = await getActiveId();
            const active = index.find((f) => f.id === activeStored) ?? index[0];
            setActiveId(active.id);
            await loadActive(active);
        })();
    }, [route]);

    const requestOpen = (file: File) => {
        if (files.length) {
            setPromptFile(file);
        } else {
            void openFile(file);
        }
    };

    const replaceWith = async (file: File) => {
        await clearFiles();
        setFiles([]);
        setActiveId(null);
        setModel(EMPTY_VIEWS);
        await openFile(file);
    };

    const openFile = async (file: File) => {
        booted.current = true;
        setDataset(null);
        window.location.hash = '/view';
        await nextFrame();
        try {
            const buffer = await file.arrayBuffer();
            // Load before adding, so a file DuckDB cannot read never enters the list.
            const id = crypto.randomUUID();
            const loaded = await loadDataset(id, file.name, buffer);
            const meta = await addFile(file.name, buffer, id);
            const next = { ...loaded, name: meta.name };
            setFiles(await listFiles());
            await restoring.current;
            setActiveId(meta.id);
            setDataset(next);
            ensureView(meta.id, next.columns);
            await whenIdle();
            notifications.show({
                color: 'teal',
                icon: <Check size={18} />,
                title: 'File loaded',
                message: `${next.name} · ${next.rowCount.toLocaleString()} rows × ${next.columns.length} columns`,
                autoClose: 5000,
            });
        } catch (e) {
            notifications.show({
                color: 'red',
                icon: <TriangleAlert size={18} />,
                title: 'Could not read file',
                message: `${file.name}: ${e instanceof Error ? e.message : String(e)}`,
                autoClose: false,
            });
            const current = files.find((f) => f.id === activeId);
            if (current) {
                await loadActive(current);
            } else {
                booted.current = false;
                window.location.hash = '';
            }
        }
    };

    const switchFile = async (meta: FileMeta) => {
        if (meta.id === activeId) {
            // Re-picking the current file is how you get a view back after closing them all.
            if (dataset && !fileViews.length) {
                ensureView(meta.id, dataset.columns);
            }
            return;
        }
        setActiveId(meta.id);
        await persistActive(meta.id);
        await loadActive(meta);
    };

    const removeFile = async (file: FileMeta) => {
        const remaining = await removeStored(file.id);
        await dropTable(file.id);
        setFiles(remaining);
        setModel((m) => {
            const views = m.views.filter((v) => v.fileId !== file.id);
            const ids = new Set(views.map((v) => v.id));
            return {
                views,
                states: pick(m.states, (id) => ids.has(id)),
                activeByFile: pick(m.activeByFile, (fileId) => fileId !== file.id),
            };
        });
        notifications.show({
            color: 'teal',
            icon: <Check size={18} />,
            title: 'File removed',
            message: file.name,
            autoClose: 5000,
        });
        if (file.id !== activeId) {
            return;
        }
        if (remaining.length) {
            setActiveId(remaining[0].id);
            await persistActive(remaining[0].id);
            await loadActive(remaining[0]);
        } else {
            setActiveId(null);
            setDataset(null);
            booted.current = false;
            window.location.hash = '';
        }
    };

    const duplicateFile = async (meta: FileMeta) => {
        const copy = await duplicateStored(meta.id);
        if (!copy) {
            return;
        }
        setFiles(await listFiles());
        notifications.show({
            color: 'teal',
            icon: <Check size={18} />,
            title: 'File duplicated',
            message: copy.name,
            autoClose: 5000,
        });
    };

    const renameFile = async (meta: FileMeta, name: string) => {
        setFiles(await renameStored(meta.id, name));
        if (meta.id === activeId && dataset) {
            setDataset({ ...dataset, name });
        }
    };

    const exportFile = async (meta: FileMeta, opts: { limit?: number; header: boolean }) => {
        let ds = meta.id === activeId ? dataset : null;
        if (!ds) {
            const buffer = await getBuffer(meta.id);
            if (!buffer) {
                return;
            }
            ds = await loadDataset(meta.id, meta.name, buffer);
        }
        const sql = exportSql({ table: ds.table, sql: '', columns: ds.columns, filters: [], search: '', sorting: [] }, ds.columns, opts.limit);
        downloadCsv(ds.name, await exportQueryCsv(sql, opts.header));
    };

    return (
        <Box style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header
                onToggleSidebar={route === 'view' ? () => setSidebarOpen((o) => !o) : undefined}
                onOpen={requestOpen}
                onExport={dataset && activeViewState ? () => setExportOpen(true) : undefined}
            />
            <Box style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                {route === 'view' && (
                    <Box style={{
                        width: sidebarOpen ? SIDEBAR_WIDTH : 0,
                        flex: 'none',
                        overflow: 'hidden',
                        borderRight: sidebarOpen ? '1px solid var(--mantine-color-default-border)' : 'none',
                        transition: 'width 0.15s ease',
                    }}>
                        <Box w={SIDEBAR_WIDTH} h="100%">
                            <Sidebar
                                files={files}
                                activeId={activeId}
                                onSwitch={switchFile}
                                onAdd={openFile}
                                onRemove={removeFile}
                                onRename={renameFile}
                                onDuplicate={duplicateFile}
                                onExport={exportFile}
                            />
                        </Box>
                    </Box>
                )}
                <Box style={{ flex: 1, minWidth: 0 }}>
                    {route === 'view'
                        ? (dataset && activeViewId && activeViewState
                            ? (
                                <DataTable
                                    dataset={dataset}
                                    exportRef={exportRef}
                                    viewState={activeViewState}
                                    onViewStateChange={updateViewState(activeViewId)}
                                    tabs={(
                                        <ViewTabs
                                            views={fileViews}
                                            activeId={activeViewId}
                                            onSelect={selectView}
                                            onClose={(view) => requestClose([view])}
                                            onCloseAll={() => requestClose(fileViews)}
                                            onCloseAllExcept={closeAllExcept}
                                            onCloseToTheLeft={closeToTheLeft}
                                            onRename={renameView}
                                            onAdd={addView}
                                        />
                                    )}
                                />
                            )
                            : dataset && !fileViews.length
                                ? <NoViews />
                                : <TableSkeleton />)
                        : <HomeRoute onFile={openFile} />}
                </Box>
            </Box>

            <Modal opened={promptFile !== null} onClose={() => setPromptFile(null)} title="Open file" centered radius="md">
                <Stack gap="md">
                    <Text fz="sm" c="dimmed">
                        Add <b>{promptFile?.name}</b> to your open files, or replace all of them?
                    </Text>
                    <Group justify="flex-end" gap="sm">
                        <Button variant="default" onClick={() => { const f = promptFile; setPromptFile(null); if (f) void replaceWith(f); }}>
                            Replace all
                        </Button>
                        <Button onClick={() => { const f = promptFile; setPromptFile(null); if (f) void openFile(f); }}>
                            Add to open files
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <ExportRowsDialog
                opened={exportOpen}
                onClose={() => setExportOpen(false)}
                onSubmit={(options) => exportRef.current?.(options)}
            />

            <ConfirmDialog
                opened={closeTarget !== null}
                title={closeTarget && closeTarget.targets.length > 1 ? 'Close views' : 'Close view'}
                message={closeTarget ? closeMessage(closeTarget) : ''}
                confirmLabel="Yes"
                cancelLabel="Cancel"
                danger
                onClose={() => setCloseTarget(null)}
                onConfirm={() => closeTarget && closeViews(closeTarget.targets)}
            />
        </Box>
    );
}

function NoViews() {
    return (
        <Center h="100%" p="md">
            <Stack align="center" gap={4}>
                <Text fw={600}>No views open</Text>
                <Text c="dimmed" fz="sm" ta="center">Pick a file in the sidebar to open one.</Text>
            </Stack>
        </Center>
    );
}

function HomeRoute({ onFile }: { onFile: (file: File) => void }) {
    return (
        <Center p="md" h="100%">
            <Stack align="center" gap="lg" w="100%" maw={700}>
                <Stack align="center" gap={6}>
                    <Title order={1} fz={{ base: 26, sm: 32 }} fw={700} lts={-0.5} ta="center">Local Parquet Viewer</Title>
                    <Text c="dimmed" ta="center">
                        Browse columns and rows, sort, filter, and export, all in your browser.
                    </Text>
                </Stack>
                <FileDrop onFile={onFile} />
            </Stack>
        </Center>
    );
}
