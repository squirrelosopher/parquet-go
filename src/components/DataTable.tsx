import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { MantineReactTable, useMantineReactTable, MRT_ShowHideColumnsButton, MRT_ToggleFiltersButton, type MRT_ColumnDef } from 'mantine-react-table';
import { Group, Text } from '@mantine/core';
import { SearchBox } from './SearchBox';
import { DensityToggle } from './DensityToggle';
import { ColumnFilter } from './ColumnFilter';
import { ArrowUp, ArrowDown, Filter, FilterX, Columns3 } from 'lucide-react';
import type { Dataset, Row } from '../lib/types';
import { formatCell } from '../lib/format';
import { exportCsv } from '../lib/exportCsv';
import { EditableHeader } from './EditableHeader';

const CHAR_PX = 8;
const CELL_CHROME = 46;
const MIN_FLOOR = 64;
const MIN_CAP = 240;
const SAMPLE_ROWS = 500;
const COLUMN_NAME_MAX = 100;

const longestWord = (text: string): number =>
    text.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0);

function columnMinSize(header: string, sample: string[]): number {
    const chars = Math.max(longestWord(header), ...sample.map(longestWord), 0);
    return Math.min(MIN_CAP, Math.max(MIN_FLOOR, chars * CHAR_PX + CELL_CHROME));
}

const editInputStyles = { input: { padding: 0, height: 'auto', minHeight: 0, lineHeight: 'inherit', fontSize: 'inherit', borderRadius: 0 } };

export function DataTable({ dataset, exportRef }: { dataset: Dataset; exportRef: MutableRefObject<(() => void) | null> }) {
    const keys = dataset.columns;
    const [labels, setLabels] = useState(keys);
    const [compact, setCompact] = useState(true);
    const edits = useRef(new Map<Row, Record<string, string>>());

    useEffect(() => {
        setLabels(dataset.columns);
        edits.current = new Map();
    }, [dataset]);

    const renameColumn = useCallback((index: number, name: string) => {
        setLabels((prev) => prev.map((l, i) => (i === index ? name : l)));
    }, []);

    const updateCell = useCallback((original: Row, key: string, value: string) => {
        const current = edits.current.get(original) ?? {};
        edits.current.set(original, { ...current, [key]: value });
    }, []);

    const cellValue = (original: Row, key: string, raw: unknown): unknown => {
        const overlay = edits.current.get(original);
        return overlay && key in overlay ? overlay[key] : raw;
    };

    const columns = useMemo<MRT_ColumnDef<Row>[]>(() => {
        const sampleRows = dataset.rows.slice(0, SAMPLE_ROWS);
        return keys.map((key, index) => ({
            id: key,
            accessorFn: (row) => row[key],
            header: labels[index] ?? key,
            Header: ({ column }) => (
                <EditableHeader
                    label={labels[index] ?? ''}
                    maxLength={COLUMN_NAME_MAX}
                    onRename={(name) => renameColumn(index, name)}
                    onSort={() => column.toggleSorting()}
                />
            ),
            Filter: ({ column }) => <ColumnFilter column={column} placeholder={`Filter by ${labels[index] ?? key}`} />,
            Cell: ({ cell, row }) => formatCell(cellValue(row.original, key, cell.getValue())),
            mantineEditTextInputProps: ({ row }) => ({
                variant: 'unstyled',
                styles: editInputStyles,
                onBlur: (e: React.FocusEvent<HTMLInputElement>) => updateCell(row.original, key, e.currentTarget.value),
            }),
            minSize: columnMinSize(key, sampleRows.map((row) => formatCell(row[key]))),
        }));
    }, [dataset, keys, labels, renameColumn, updateCell]);

    const table = useMantineReactTable({
        columns,
        data: dataset.rows,
        enableColumnResizing: true,
        enableStickyHeader: true,
        enableFacetedValues: false,
        enableRowVirtualization: false,
        enableSortingRemoval: false,
        enableDensityToggle: false,
        enableFullScreenToggle: false,
        enableEditing: true,
        editDisplayMode: 'cell',
        sortDescFirst: false,
        positionGlobalFilter: 'none',
        icons: {
            IconArrowsSort: (props: object) => <ArrowUp {...props} size={14} />,
            IconSortAscending: (props: object) => <ArrowUp {...props} size={14} color="var(--mantine-color-green-6)" />,
            IconSortDescending: (props: object) => <ArrowDown {...props} size={14} color="var(--mantine-color-red-6)" />,
            IconFilter: (props: object) => <Filter {...props} size={18} />,
            IconFilterOff: (props: object) => <FilterX {...props} size={18} />,
            IconColumns: (props: object) => <Columns3 {...props} size={18} />,
        },
        initialState: {
            density: 'xs',
            sorting: keys.length ? [{ id: keys[0], desc: false }] : [],
            pagination: { pageIndex: 0, pageSize: 25 },
        },
        mantinePaperProps: { withBorder: false, radius: 0, className: compact ? 'pv-compact' : undefined, style: { height: '100%', display: 'flex', flexDirection: 'column' } },
        mantineTableContainerProps: { style: { flex: 1 } },
        mantinePaginationProps: { size: 'sm' },
        renderTopToolbarCustomActions: () => (
            <Text c="dimmed" fz="xs" style={{ whiteSpace: 'nowrap' }}>
                {dataset.name} · {dataset.rows.length.toLocaleString()} rows × {keys.length} cols
            </Text>
        ),
        renderToolbarInternalActions: ({ table }) => (
            <Group gap={2} wrap="nowrap">
                <SearchBox table={table} />
                <MRT_ToggleFiltersButton table={table} />
                <MRT_ShowHideColumnsButton table={table} />
                <DensityToggle compact={compact} onToggle={() => setCompact((c) => !c)} />
            </Group>
        ),
    });

    useEffect(() => {
        exportRef.current = () => {
            const exportColumns = keys.map((key, i) => ({ key, label: labels[i] ?? key }));
            const rows = table.getPrePaginationRowModel().rows.map((r) => {
                const overlay = edits.current.get(r.original);
                return overlay ? { ...r.original, ...overlay } : r.original;
            });
            exportCsv(dataset.name, exportColumns, rows);
        };
        return () => { exportRef.current = null; };
    }, [table, dataset, keys, labels, exportRef]);

    return <MantineReactTable table={table} />;
}
