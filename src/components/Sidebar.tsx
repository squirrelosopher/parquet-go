import { useState } from 'react';
import { Stack, Text, Group, ScrollArea, Divider, Menu } from '@mantine/core';
import { Box as CubeIcon, Pencil, Download, FileDown, Trash2 } from 'lucide-react';
import { FileDrop } from './FileDrop';
import { RenameDialog } from './RenameDialog';
import { ExportRowsDialog, type ExportRowsOptions } from './ExportRowsDialog';
import { ConfirmDialog } from './ConfirmDialog';
import type { FileMeta } from '../lib/store';

export interface ExportRequest {
    limit?: number;
    header: boolean;
}

interface SidebarProps {
    files: FileMeta[];
    activeId: string | null;
    onSwitch: (file: FileMeta) => void;
    onAdd: (file: File) => void;
    onRemove: (file: FileMeta) => void;
    onRename: (file: FileMeta, name: string) => void;
    onExport: (file: FileMeta, request: ExportRequest) => void;
}

interface MenuState {
    file: FileMeta;
    x: number;
    y: number;
}

export function Sidebar({ files, activeId, onSwitch, onAdd, onRemove, onRename, onExport }: SidebarProps) {
    const [menu, setMenu] = useState<MenuState | null>(null);
    const [renameTarget, setRenameTarget] = useState<FileMeta | null>(null);
    const [exportTarget, setExportTarget] = useState<FileMeta | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<FileMeta | null>(null);

    return (
        <Stack gap="sm" p="sm" h="100%">
            <Text fz="xs" fw={700} tt="uppercase" c="dimmed" lts={0.6}>Files</Text>
            <ScrollArea style={{ flex: 1 }} type="hover">
                <Stack gap={2}>
                    {files.map((file) => (
                        <Group
                            key={file.id}
                            className="file-item"
                            data-active={file.id === activeId}
                            gap="xs"
                            wrap="nowrap"
                            onClick={() => onSwitch(file)}
                            onContextMenu={(e) => { e.preventDefault(); setMenu({ file, x: e.clientX, y: e.clientY }); }}
                        >
                            <CubeIcon size={16} style={{ flex: 'none' }} />
                            <Text fz="sm" truncate style={{ flex: 1, minWidth: 0 }}>{file.name}</Text>
                        </Group>
                    ))}
                </Stack>
            </ScrollArea>
            <Divider />
            <FileDrop onFile={onAdd} compact />

            {menu && (
                <Menu opened onClose={() => setMenu(null)} withinPortal position="right-start" offset={2}>
                    <Menu.Target>
                        <div style={{ position: 'fixed', left: menu.x, top: menu.y, width: 1, height: 1 }} />
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item leftSection={<Pencil size={14} />} onClick={() => { setRenameTarget(menu.file); setMenu(null); }}>
                            Rename
                        </Menu.Item>
                        <Menu.Item leftSection={<Download size={14} />} onClick={() => { setExportTarget(menu.file); setMenu(null); }}>
                            Export rows…
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
            <ExportRowsDialog
                opened={exportTarget !== null}
                onClose={() => setExportTarget(null)}
                onSubmit={(options: ExportRowsOptions) => exportTarget && onExport(exportTarget, options)}
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
