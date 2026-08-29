import { useMemo, useState } from 'react';
import { ActionIcon, Button, Menu, Tooltip } from '@mantine/core';
import { MRT_ShowHideColumnsMenuItems, type MRT_Column, type MRT_TableInstance } from 'mantine-react-table';
import { Columns3 } from 'lucide-react';
import type { Row } from '../lib/types';

const LABEL = 'Show or hide columns';

interface ColumnsMenuProps {
    table: MRT_TableInstance<Row>;
    opened: boolean;
    onChange: (opened: boolean) => void;
}

export function ColumnsMenu({ table, opened, onChange }: ColumnsMenuProps) {
    const [hoveredColumn, setHoveredColumn] = useState<MRT_Column<Row> | null>(null);
    const { columnOrder } = table.getState();

    const columns = table.getAllColumns();
    const orderedColumns = useMemo(() => {
        if (!columnOrder.length) {
            return columns;
        }
        return [...columns].sort((a, b) => columnOrder.indexOf(a.id) - columnOrder.indexOf(b.id));
    }, [columns, columnOrder]);

    const leafColumns = table.getAllLeafColumns();
    const allShown = leafColumns.every((column) => column.getIsVisible());

    const showAll = () => leafColumns.forEach((column) => column.toggleVisibility(true));

    return (
        <Menu opened={opened} onChange={onChange} closeOnItemClick={false} withinPortal>
            <Tooltip label={LABEL} withArrow>
                <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" size="lg" aria-label={LABEL}>
                        <Columns3 size={18} />
                    </ActionIcon>
                </Menu.Target>
            </Tooltip>
            <Menu.Dropdown>
                <Button
                    className="columns-menu-action"
                    variant="subtle"
                    size="compact-sm"
                    fullWidth
                    disabled={allShown}
                    onClick={showAll}
                >
                    Show all
                </Button>
                <Menu.Divider />
                {orderedColumns.map((column) => (
                    <MRT_ShowHideColumnsMenuItems
                        key={column.id}
                        allColumns={orderedColumns}
                        column={column}
                        hoveredColumn={hoveredColumn}
                        setHoveredColumn={setHoveredColumn}
                        table={table}
                    />
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}
