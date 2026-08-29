import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Stack, Text, Group, ScrollArea, Divider, Menu, Tooltip, ActionIcon } from '@mantine/core';
import { Box as CubeIcon, Pencil, Copy, FileDown, Trash2, Eye, EyeOff } from 'lucide-react';
import { DropZoneLayout, FileDrop } from './FileDrop';
import { RenameDialog } from './RenameDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { tableNameOf } from '../lib/duckdb';
import type { CsvExportOptions } from '../lib/exportCsv';
import type { FileMeta } from '../lib/store';

interface SidebarProps {
    files: FileMeta[];
    activeId: string | null;
    onSwitch: (file: FileMeta) => void;
    onAdd: (file: File) => void;
    onRemove: (file: FileMeta) => void;
    onRename: (file: FileMeta, name: string) => void;
    onDuplicate: (file: FileMeta) => void;
    onExport: (file: FileMeta, options: CsvExportOptions) => void;
    onMinWidth: (width: number) => void;
}

const NAME_TRAILING_SPACE = 20;

interface MenuState {
    file: FileMeta;
    x: number;
    y: number;
}

export function Sidebar({ files, activeId, onSwitch, onAdd, onRemove, onRename, onDuplicate, onExport, onMinWidth }: SidebarProps) {
    const [menu, setMenu] = useState<MenuState | null>(null);
    const [renameTarget, setRenameTarget] = useState<FileMeta | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<FileMeta | null>(null);
    const [showAliases, setShowAliases] = useState(true);
    const rootRef = useRef<HTMLDivElement>(null);

    const reportWidestName = useCallback(() => {
        const root = rootRef.current;
        if (!root) {
            return;
        }
        const left = root.getBoundingClientRect().left;
        let widest = 0;
        for (const name of root.querySelectorAll<HTMLElement>('.file-item-name')) {
            widest = Math.max(widest, name.getBoundingClientRect().right - left);
        }
        onMinWidth(widest ? Math.ceil(widest + NAME_TRAILING_SPACE) : 0);
    }, [onMinWidth]);

    useLayoutEffect(() => {
        reportWidestName();
        void document.fonts?.ready.then(reportWidestName);
    }, [files, reportWidestName]);

    return (
        <Stack ref={rootRef} gap="sm" p="sm" h="100%">
            <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
                <Text fz="xs" fw={700} tt="uppercase" c="dimmed" lts={0.6}>Files</Text>
                <Tooltip label={showAliases ? 'Hide SQL aliases' : 'Show SQL aliases'} withArrow>
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label={showAliases ? 'Hide SQL aliases' : 'Show SQL aliases'}
                        aria-pressed={showAliases}
                        onClick={() => setShowAliases((shown) => !shown)}
                    >
                        {showAliases ? <Eye size={14} /> : <EyeOff size={14} />}
                    </ActionIcon>
                </Tooltip>
            </Group>
            <ScrollArea style={{ flex: 1 }} type="hover">
                <Stack gap={2}>
                    {files.map((file) => (
                        <Tooltip
                            key={file.id}
                            label={showAliases ? `${file.name} · ${tableNameOf(file.id, file.name)}` : file.name}
                            openDelay={400}
                            position="right"
                            withArrow
                        >
                            <Group
                                className="file-item"
                                data-active={file.id === activeId}
                                gap="xs"
                                wrap="nowrap"
                                onClick={() => onSwitch(file)}
                                onContextMenu={(e) => { e.preventDefault(); setMenu({ file, x: e.clientX, y: e.clientY }); }}
                            >
                                <CubeIcon size={16} style={{ flex: 'none' }} />
                                <Text className="file-item-name" fz="sm">{file.name}</Text>
                                {showAliases && <Text className="file-item-alias" fz="xs">{tableNameOf(file.id, file.name)}</Text>}
                            </Group>
                        </Tooltip>
                    ))}
                </Stack>
            </ScrollArea>
            <Divider />
            <FileDrop onFile={onAdd} layout={DropZoneLayout.Compact} />

            {menu && (
                <Menu opened onClose={() => setMenu(null)} withinPortal position="right-start" offset={2}>
                    <Menu.Target>
                        <div style={{ position: 'fixed', left: menu.x, top: menu.y, width: 1, height: 1 }} />
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item leftSection={<Pencil size={14} />} onClick={() => { setRenameTarget(menu.file); setMenu(null); }}>
                            Rename
                        </Menu.Item>
                        <Menu.Item leftSection={<Copy size={14} />} onClick={() => { onDuplicate(menu.file); setMenu(null); }}>
                            Duplicate
                        </Menu.Item>
                        <Menu.Item leftSection={<FileDown size={14} />} onClick={() => { onExport(menu.file, { header: true }); setMenu(null); }}>
                            Export as CSV
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={() => { setDeleteTarget(menu.file); setMenu(null); }}>
                            Delete
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            )}

            <RenameDialog
                opened={renameTarget !== null}
                initialName={renameTarget?.name ?? ''}
                onClose={() => setRenameTarget(null)}
                onSubmit={(name) => renameTarget && onRename(renameTarget, name)}
            />
            <ConfirmDialog
                opened={deleteTarget !== null}
                title="Delete file"
                message={`Delete “${deleteTarget?.name}”?`}
                confirmLabel="Yes"
                cancelLabel="No"
                danger
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && onRemove(deleteTarget)}
            />
        </Stack>
    );
}
