import { useEffect, useRef, useState } from 'react';
import { Box, Center, Stack, Title, Text, Modal, Button, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Check, TriangleAlert } from 'lucide-react';
import { Header } from './components/Header';
import { FileDrop } from './components/FileDrop';
import { CubeLoader } from './components/CubeLoader';
import { DataTable } from './components/DataTable';
import { Sidebar } from './components/Sidebar';
import { parseBuffer } from './lib/readFile';
import { exportCsv } from './lib/exportCsv';
import { listFiles, getActiveId, getBuffer, addFile, clearFiles, renameFile as renameStored, setActiveId as persistActive, removeFile as removeStored, type FileMeta } from './lib/store';
import type { Dataset } from './lib/types';

const SIDEBAR_WIDTH = 280;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
const getRoute = (): 'home' | 'view' => (window.location.hash.replace(/^#\/?/, '') === 'view' ? 'view' : 'home');

const whenIdle = () => new Promise<void>((resolve) => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    ric ? ric(() => resolve(), { timeout: 400 }) : setTimeout(resolve, 150);
});

export function App() {
    const [files, setFiles] = useState<FileMeta[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [dataset, setDataset] = useState<Dataset | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [route, setRoute] = useState(getRoute);
    const [promptFile, setPromptFile] = useState<File | null>(null);
    const booted = useRef(false);
    const exportRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        const onHash = () => setRoute(getRoute());
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    const loadActive = async (meta: FileMeta) => {
        setDataset(null);
        const buffer = await getBuffer(meta.id);
        if (buffer) {
            setDataset(await parseBuffer(meta.name, buffer));
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
        await openFile(file);
    };

    const openFile = async (file: File) => {
        booted.current = true;
        setDataset(null);
        window.location.hash = '/view';
        await nextFrame();
        try {
            const buffer = await file.arrayBuffer();
            const parsed = await parseBuffer(file.name, buffer);
            const meta = await addFile(file.name, buffer);
            const next = { ...parsed, name: meta.name };
            setFiles(await listFiles());
            setActiveId(meta.id);
            setDataset(next);
            await whenIdle();
            notifications.show({
                color: 'teal',
                icon: <Check size={18} />,
                title: 'File loaded',
                message: `${next.name} · ${next.rows.length.toLocaleString()} rows × ${next.columns.length} columns`,
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
            return;
        }
        setActiveId(meta.id);
        await persistActive(meta.id);
        await loadActive(meta);
    };

    const removeFile = async (file: FileMeta) => {
        const remaining = await removeStored(file.id);
        setFiles(remaining);
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
            ds = await parseBuffer(meta.name, buffer);
        }
        const rows = opts.limit ? ds.rows.slice(0, opts.limit) : ds.rows;
        exportCsv(ds.name, ds.columns.map((c) => ({ key: c, label: c })), rows, opts.header);
    };

    return (
        <Box style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header
                onToggleSidebar={route === 'view' ? () => setSidebarOpen((o) => !o) : undefined}
                onOpen={requestOpen}
                onExport={dataset ? () => exportRef.current?.() : undefined}
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
                                onExport={exportFile}
                            />
                        </Box>
                    </Box>
                )}
                <Box style={{ flex: 1, minWidth: 0 }}>
                    {route === 'view'
                        ? (dataset ? <DataTable dataset={dataset} exportRef={exportRef} /> : <Center h="100%"><CubeLoader /></Center>)
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
        </Box>
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
