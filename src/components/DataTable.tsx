import { useCallback, useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from 'react';
import { MantineReactTable, useMantineReactTable, MRT_ShowHideColumnsButton, MRT_ToggleFiltersButton, type MRT_ColumnDef, type MRT_Updater } from 'mantine-react-table';
import { Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { SearchBox } from './SearchBox';
import { DensityToggle } from './DensityToggle';
import { FullscreenToggle } from './FullscreenToggle';
import { ColumnFilter } from './ColumnFilter';
import { ArrowUp, ArrowDown, Filter, FilterX, Columns3, TriangleAlert } from 'lucide-react';
import type { Dataset, Row } from '../lib/types';
import { resolveUpdater, type ViewState } from '../lib/views';
import { execute, exportQueryCsv, query, queryScalar, ROW_ID } from '../lib/duckdb';
import { countSql, exportSql, pageSql, updateCellSql, type QuerySpec } from '../lib/sql';
import { formatCell } from '../lib/format';
import { downloadCsv } from '../lib/exportCsv';
import { EditableHeader } from './EditableHeader';
import type { ExportRowsOptions } from './ExportRowsDialog';

const CHAR_PX = 8;
const CELL_CHROME = 46;
const MIN_FLOOR = 64;
const MIN_CAP = 240;
const SAMPLE_ROWS = 200;
const SLOW_QUERY_MS = 250;
const COLUMN_NAME_MAX = 100;

const longestWord = (text: string): number =>
    text.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0);

function columnMinSize(header: string, sample: string[]): number {
    const chars = Math.max(longestWord(header), ...sample.map(longestWord), 0);
    return Math.min(MIN_CAP, Math.max(MIN_FLOOR, chars * CHAR_PX + CELL_CHROME));
}

const editInputStyles = { input: { padding: 0, height: 'auto', minHeight: 0, lineHeight: 'inherit', fontSize: 'inherit', border: 'none', borderRadius: 0 } };

const failed = (action: string, error: unknown) => notifications.show({
    color: 'red',
    icon: <TriangleAlert size={18} />,
    title: `Could not ${action}`,
    message: error instanceof Error ? error.message : String(error),
    autoClose: 6000,
});

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
    const [fullscreen, setFullscreen] = useState(false);
    const [rows, setRows] = useState<Row[]>([]);
    const [sample, setSample] = useState<Row[]>([]);
    const [total, setTotal] = useState(dataset.rowCount);
    const [loading, setLoading] = useState(false);
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        setLabels(dataset.columns);
        setSearch('');
    }, [dataset]);

    const { pageIndex, pageSize } = viewState.pagination;
    const spec: QuerySpec = {
        table: dataset.table,
        columns: keys,
        filters: viewState.columnFilters,
        search,
        sorting: viewState.sorting,
    };
    // Effects key off the query's shape, not the objects that describe it.
    const specKey = JSON.stringify([spec.table, spec.columns, spec.filters, spec.search, spec.sorting]);

    // One page of rows — the only rows that ever become JS objects.
    useEffect(() => {
        let cancelled = false;
        // Most queries land in tens of milliseconds. Announcing those would flash a bar
        // on every keystroke for work that is already done, so only slow ones show one.
        const announce = window.setTimeout(() => setLoading(true), SLOW_QUERY_MS);
        (async () => {
            try {
                const page = await query(pageSql(spec, pageSize, pageIndex * pageSize));
                if (!cancelled) {
                    setRows(page);
                }
            } catch (error) {
                if (!cancelled) {
                    setRows([]);
                    failed('run that query', error);
                }
            } finally {
                window.clearTimeout(announce);
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();
        return () => { cancelled = true; window.clearTimeout(announce); };
    }, [specKey, pageIndex, pageSize, revision]);

    // The count only moves when the predicate does, so paging does not re-scan.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const count = await queryScalar(countSql(spec));
                if (!cancelled) {
                    setTotal(count);
                }
            } catch {
                if (!cancelled) {
                    setTotal(0);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [specKey, revision]);

    // Column widths come from a fixed sample so they do not shift from page to page.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const head = await query(pageSql({ ...spec, filters: [], search: '', sorting: [] }, SAMPLE_ROWS, 0));
                if (!cancelled) {
                    setSample(head);
                }
            } catch {
                if (!cancelled) {
                    setSample([]);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [dataset.table]);

    useEffect(() => {
        if (!fullscreen) {
            return;
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') {
                return;
            }
            // Whatever is being typed in gets Escape first — cancelling a cell edit or
            // closing the search should not also drop out of fullscreen.
            const target = e.target as HTMLElement | null;
            if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }
            setFullscreen(false);
        };
        // Capture, because a tooltip on the focused control would otherwise swallow it.
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [fullscreen]);

    const renameColumn = useCallback((index: number, name: string) => {
        setLabels((prev) => prev.map((l, i) => (i === index ? name : l)));
    }, []);

    const updateCell = useCallback(async (rowId: number, column: string, value: string) => {
        try {
            await execute(updateCellSql(dataset.table, rowId, column, value));
            setRevision((r) => r + 1);
        } catch (error) {
            failed('save that cell', error);
        }
    }, [dataset.table]);

    /** Route one slice of the grid's state back into the active view. */
    const patch = useCallback(
        <K extends keyof ViewState>(key: K) => (updater: MRT_Updater<ViewState[K]>) =>
            onViewStateChange((previous) => ({ ...previous, [key]: resolveUpdater(updater, previous[key]) })),
        [onViewStateChange],
    );

    const columns = useMemo<MRT_ColumnDef<Row>[]>(() => keys.map((key, index) => ({
        id: key,
        accessorFn: (row) => row[key],
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
        Cell: ({ cell }) => formatCell(cell.getValue()),
        mantineEditTextInputProps: ({ row }) => ({
            variant: 'unstyled',
            styles: editInputStyles,
            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                void updateCell(Number(row.original[ROW_ID]), key, e.currentTarget.value);
            },
        }),
        minSize: columnMinSize(key, sample.map((row) => formatCell(row[key]))),
    })), [keys, labels, sample, renameColumn, updateCell]);

    const table = useMantineReactTable({
        columns,
        data: rows,
        // DuckDB does the filtering, sorting and paging; the grid is a window onto it.
        manualFiltering: true,
        manualSorting: true,
        manualPagination: true,
        rowCount: total,
        getRowId: (row) => String(row[ROW_ID]),
        enableColumnResizing: true,
        enableStickyHeader: true,
        enableFacetedValues: false,
        enableRowVirtualization: false,
        enableSortingRemoval: false,
        enableDensityToggle: false,
        enableFullScreenToggle: true,
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
            isLoading: loading,
            isFullScreen: fullscreen,
        },
        onSortingChange: patch('sorting'),
        onColumnFiltersChange: patch('columnFilters'),
        onPaginationChange: patch('pagination'),
        onColumnVisibilityChange: patch('columnVisibility'),
        onColumnSizingChange: patch('columnSizing'),
        onColumnOrderChange: patch('columnOrder'),
        onIsFullScreenChange: (updater: MRT_Updater<boolean>) =>
            setFullscreen((previous) => resolveUpdater(updater, previous)),
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
                {dataset.name} · {dataset.rowCount.toLocaleString()} rows × {keys.length} cols
            </Text>
        ),
        renderToolbarInternalActions: ({ table }) => (
            <Group gap={2} wrap="nowrap">
                <SearchBox table={table} />
                <MRT_ToggleFiltersButton table={table} />
                <MRT_ShowHideColumnsButton table={table} />
                <DensityToggle compact={compact} onToggle={() => setCompact((c) => !c)} />
                <FullscreenToggle active={fullscreen} onToggle={() => setFullscreen((f) => !f)} />
            </Group>
        ),
    });

    useEffect(() => {
        exportRef.current = (options) => {
            void (async () => {
                try {
                    const bytes = await exportQueryCsv(exportSql(spec, labels, options.limit), options.header);
                    downloadCsv(dataset.name, bytes);
                } catch (error) {
                    failed('export that view', error);
                }
            })();
        };
        return () => { exportRef.current = null; };
    }, [specKey, labels, dataset.name, exportRef]);

    return <MantineReactTable table={table} />;
}
