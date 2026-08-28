import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { MantineReactTable, useMantineReactTable, MRT_ShowHideColumnsButton, MRT_ToggleFiltersButton, type MRT_ColumnDef, type MRT_Updater } from 'mantine-react-table';
import { Group, Text } from '@mantine/core';
import { SearchBox } from './SearchBox';
import { DensityToggle } from './DensityToggle';
import { ColumnFilter } from './ColumnFilter';
import { ArrowUp, ArrowDown, Filter, FilterX, Columns3 } from 'lucide-react';
import type { Dataset, Row } from '../lib/types';
import { resolveUpdater, type ViewState } from '../lib/views';
import { formatCell } from '../lib/format';
import { exportCsv } from '../lib/exportCsv';
import { EditableHeader } from './EditableHeader';
import type { ExportRowsOptions } from './ExportRowsDialog';

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

const editInputStyles = { input: { padding: 0, height: 'auto', minHeight: 0, lineHeight: 'inherit', fontSize: 'inherit', border: 'none', borderRadius: 0 } };

interface DataTableProps {
    dataset: Dataset;
    exportRef: MutableRefObject<((options: ExportRowsOptions) => void) | null>;
    viewState: ViewState;
    onViewStateChange: (update: (previous: ViewState) => ViewState) => void;
    tabs?: ReactNode;
}

export function DataTable({ dataset, exportRef, viewState, onViewStateChange, tabs }: DataTableProps) {
    const keys = dataset.columns;
    const [labels, setLabels] = useState(keys);
    const [compact, setCompact] = useState(true);
    // The toolbar search and the filter row's visibility span every view, so they sit
    // beside the grid rather than inside a view's state. The filter *values* stay per view.
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const edits = useRef(new Map<Row, Record<string, string>>());

    useEffect(() => {
        setLabels(dataset.columns);
        setSearch('');
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

    /** Route one slice of the grid's state back into the active view. */
    const patch = useCallback(
        <K extends keyof ViewState>(key: K) => (updater: MRT_Updater<ViewState[K]>) =>
            onViewStateChange((previous) => ({ ...previous, [key]: resolveUpdater(updater, previous[key]) })),
        [onViewStateChange],
    );

    const columns = useMemo<MRT_ColumnDef<Row>[]>(() => {
        const sampleRows = dataset.rows.slice(0, SAMPLE_ROWS);
        return keys.map((key, index) => ({
            id: key,
            accessorFn: (row) => row[key],
            // Plain substring, not MRT's default fuzzy match — "aaa" must mean three
            // in a row, not three scattered through the value.
            filterFn: 'contains',
            header: labels[index] ?? key,
            Header: ({ column }) => (
                <EditableHeader
                    label={labels[index] ?? ''}
                    maxLength={COLUMN_NAME_MAX}
                    // A filtered column is accented whether or not the filter row is
                    // open, so the header alone tells you what is narrowing the view.
                    filtered={column.getIsFiltered()}
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
        // Ranked results reorder rows by match score, so clearing the search made them
        // visibly rearrange back into the view's own sort. Filter, do not re-rank.
        enableGlobalFilterRankedResults: false,
        globalFilterFn: 'contains',
        positionGlobalFilter: 'none',
        icons: {
            IconArrowsSort: (props: object) => <ArrowUp {...props} size={14} />,
            IconSortAscending: (props: object) => <ArrowUp {...props} size={14} color="var(--mantine-color-green-6)" />,
            IconSortDescending: (props: object) => <ArrowDown {...props} size={14} color="var(--mantine-color-red-6)" />,
            IconFilter: (props: object) => <Filter {...props} size={18} />,
            IconFilterOff: (props: object) => <FilterX {...props} size={18} />,
            IconColumns: (props: object) => <Columns3 {...props} size={18} />,
        },
        initialState: { density: 'xs' },
        // Sorting, filters and column layout live on the view, so each tab keeps its own.
        state: {
            sorting: viewState.sorting,
            columnFilters: viewState.columnFilters,
            globalFilter: search || undefined,
            pagination: viewState.pagination,
            columnVisibility: viewState.columnVisibility,
            columnSizing: viewState.columnSizing,
            columnOrder: viewState.columnOrder,
            showColumnFilters: showFilters,
        },
        onSortingChange: patch('sorting'),
        onColumnFiltersChange: patch('columnFilters'),
        onPaginationChange: patch('pagination'),
        onColumnVisibilityChange: patch('columnVisibility'),
        onColumnSizingChange: patch('columnSizing'),
        onColumnOrderChange: patch('columnOrder'),
        onShowColumnFiltersChange: (updater: MRT_Updater<boolean>) =>
            setShowFilters((previous) => resolveUpdater(updater, previous)),
        onGlobalFilterChange: (updater: MRT_Updater<string | undefined>) =>
            setSearch((previous) => resolveUpdater(updater, previous || undefined) ?? ''),
        mantinePaperProps: { withBorder: false, radius: 0, className: compact ? 'pv-compact' : undefined, style: { height: '100%', display: 'flex', flexDirection: 'column' } },
        mantineTopToolbarProps: { className: 'pv-top-toolbar' },
        mantineTableContainerProps: { style: { flex: 1 } },
        // MRT hides the first/last buttons under three pages; keep all four in place
        // and let them disable themselves, so the control never changes shape.
        mantinePaginationProps: { size: 'sm', withEdges: true },
        renderTopToolbarCustomActions: () => <>{tabs}</>,
        renderBottomToolbarCustomActions: () => (
            <Text className="dataset-summary" c="dimmed" fz="xs" style={{ whiteSpace: 'nowrap' }}>
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
        exportRef.current = (options) => {
            const exportColumns = keys.map((key, i) => ({ key, label: labels[i] ?? key }));
            // Everything the view resolves to, minus paging — then the requested slice.
            const visible = table.getPrePaginationRowModel().rows.map((r) => {
                const overlay = edits.current.get(r.original);
                return overlay ? { ...r.original, ...overlay } : r.original;
            });
            const rows = options.limit ? visible.slice(0, options.limit) : visible;
            exportCsv(dataset.name, exportColumns, rows, options.header);
        };
        return () => { exportRef.current = null; };
    }, [table, dataset, keys, labels, exportRef]);

    return <MantineReactTable table={table} />;
}
