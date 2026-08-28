import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { MantineReactTable, useMantineReactTable, type MRT_ColumnDef } from 'mantine-react-table';
import { Text } from '@mantine/core';
import { ArrowUp, ArrowDown } from 'lucide-react';
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

const editInputStyles = { input: { padding: 0, height: 'auto', minHeight: 0, lineHeight: 'inherit', fontSize: 'inherit', backgroundColor: 'var(--mantine-color-default-hover)' } };

export function DataTable({ dataset, exportRef }: { dataset: Dataset; exportRef: MutableRefObject<(() => void) | null> }) {
    const keys = dataset.columns;
    const [labels, setLabels] = useState(keys);

    // Cell edits are held in an overlay keyed by the row object, so the data
    // array is never rebuilt and TanStack does not re-sort on every edit.
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
        // Pagination renders one page at a time, so row virtualization is
        // redundant; it also breaks cell-edit exit in this MRT beta.
        enableRowVirtualization: false,
        enableSortingRemoval: false,
        enableDensityToggle: false,
        enableFullScreenToggle: false,
        enableEditing: true,
        editDisplayMode: 'cell',
        sortDescFirst: false,
        icons: {
            IconArrowsSort: (props: object) => <ArrowUp {...props} size={14} />,
            IconSortAscending: (props: object) => <ArrowUp {...props} size={14} color="var(--mantine-color-green-6)" />,
            IconSortDescending: (props: object) => <ArrowDown {...props} size={14} color="var(--mantine-color-red-6)" />,
        },
        initialState: {
            density: 'xs',
            sorting: keys.length ? [{ id: keys[0], desc: false }] : [],
            pagination: { pageIndex: 0, pageSize: 25 },
        },
        mantinePaperProps: { withBorder: false, radius: 0, style: { height: '100%', display: 'flex', flexDirection: 'column' } },
        mantineTableContainerProps: { style: { flex: 1 } },
        mantinePaginationProps: { size: 'sm' },
        renderTopToolbarCustomActions: () => (
            <Text c="dimmed" fz="xs" style={{ whiteSpace: 'nowrap' }}>
                {dataset.name} · {dataset.rows.length.toLocaleString()} rows × {keys.length} cols
            </Text>
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
