import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from 'react';
import { MantineReactTable, useMantineReactTable, MRT_ToggleFiltersButton, MRT_TopToolbar, type MRT_ColumnDef, type MRT_Updater } from 'mantine-react-table';
import { Box, Collapse, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { SearchBox } from './SearchBox';
import { DensityToggle } from './DensityToggle';
import { FullscreenToggle } from './FullscreenToggle';
import { SqlToggle } from './SqlToggle';
import { ColumnsMenu } from './ColumnsMenu';
// The editor is off by default and drags in CodeMirror, so it is fetched on first use.
const SqlEditor = lazy(() => import('./SqlEditor').then((m) => ({ default: m.SqlEditor })));
import { ColumnFilter } from './ColumnFilter';
import { ArrowUp, ArrowDown, Check, Filter, FilterX, Columns3, TriangleAlert } from 'lucide-react';
import type { Dataset, Row } from '../lib/types';
import { resolveUpdater, retargetViewState, type ViewState } from '../lib/views';
import { describeQuery, execute, exportQueryCsv, query, queryScalar, ROW_ID } from '../lib/duckdb';
import { cellSql, countSql, exportSql, pageSql, trimStatement, updateCellSql, type QuerySpec } from '../lib/sql';
import { formatCell } from '../lib/format';
import { ShortcutId } from '../lib/shortcuts';
import { useShortcuts } from '../lib/useShortcuts';
import { downloadCsv, type CsvExportOptions } from '../lib/exportCsv';
import { EditableHeader } from './EditableHeader';

const CHAR_PX = 8;
const CELL_CHROME = 46;
const MIN_FLOOR = 64;
const MIN_CAP = 240;
const SAMPLE_ROWS = 200;
const SLOW_QUERY_MS = 250;
const COLUMN_NAME_MAX = 100;
const SQL_EDITOR_SLIDE_MS = 200;

const RETURNS_ROWS = /^\s*(WITH|SELECT|FROM|VALUES|TABLE|DESCRIBE|SHOW|SUMMARIZE|PIVOT|UNPIVOT|EXPLAIN|CALL)\b/i;

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

const notifyStatement = (affected: number | null) => notifications.show({
    color: 'teal',
    icon: <Check size={18} />,
    title: 'Statement ran',
    message: affected === null
        ? 'No rows to change.'
        : `${affected.toLocaleString()} ${affected === 1 ? 'row' : 'rows'} affected.`,
    autoClose: 4000,
});

const notifyUnchanged = () => notifications.show({
    color: 'yellow',
    icon: <TriangleAlert size={18} />,
    title: 'Not updated',
    message: 'Use the SQL editor to write to the table directly.',
    autoClose: 6000,
});

interface DataTableProps {
    dataset: Dataset;
    exportRef: MutableRefObject<((options: CsvExportOptions) => void) | null>;
    viewState: ViewState;
    onViewStateChange: (update: (previous: ViewState) => ViewState) => void;
    tabs?: ReactNode;
}

export function DataTable({ dataset, exportRef, viewState, onViewStateChange, tabs }: DataTableProps) {
    const [labels, setLabels] = useState(dataset.columns);
    const [compact, setCompact] = useState(true);
    // The toolbar search and the filter row's visibility span every view, so they sit
    // beside the grid rather than inside a view's state. The filter *values* stay per view.
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [sqlOpen, setSqlOpen] = useState(false);
    const [sqlMounted, setSqlMounted] = useState(false);
    const [columnsOpen, setColumnsOpen] = useState(false);
    const [sqlColumns, setSqlColumns] = useState<string[] | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [sample, setSample] = useState<Row[]>([]);
    const [total, setTotal] = useState(dataset.rowCount);
    const [loading, setLoading] = useState(false);
    const [revision, setRevision] = useState(0);

    const userSql = trimStatement(viewState.sql);
    const keys = useMemo(() => (userSql ? sqlColumns ?? [] : dataset.columns), [userSql, sqlColumns, dataset.columns]);
    const ready = !userSql || sqlColumns !== null;

    useEffect(() => {
        setLabels(keys);
    }, [keys]);

    useEffect(() => {
        setSearch('');
    }, [dataset]);

    // Whatever the active view's query returns decides the grid's columns — on a fresh
    // run, on a tab switch, and on a restore from storage.
    useEffect(() => {
        if (!userSql) {
            setSqlColumns(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const found = await describeQuery(userSql);
                if (!cancelled) {
                    setSqlColumns(found);
                }
            } catch {
                if (!cancelled) {
                    setSqlColumns([]);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [userSql]);

    // The grid is unusable with nothing in it, so the last column standing cannot be
    // switched off. MRT reads enableHiding through getCanHide to disable its own switch.
    const visibleKeys = keys.filter((key) => viewState.columnVisibility[key] !== false);
    const lockedKey = visibleKeys.length === 1 ? visibleKeys[0] : null;

    const { pageIndex, pageSize } = viewState.pagination;
    const spec: QuerySpec = {
        table: dataset.table,
        sql: viewState.sql,
        columns: keys,
        filters: viewState.columnFilters,
        search,
        sorting: viewState.sorting,
    };
    // Effects key off the query's shape, not the objects that describe it.
    const predicateKey = JSON.stringify([spec.table, spec.sql, spec.columns, spec.filters, spec.search]);
    const specKey = `${predicateKey}|${JSON.stringify(spec.sorting)}`;

    // One page of rows — the only rows that ever become JS objects.
    useEffect(() => {
        if (!ready) {
            return;
        }
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
    }, [specKey, pageIndex, pageSize, revision, ready]);

    // The count only moves when the predicate does, so paging does not re-scan.
    useEffect(() => {
        if (!ready) {
            return;
        }
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
    }, [predicateKey, revision, ready]);

    // Column widths come from a fixed sample so they do not shift from page to page.
    useEffect(() => {
        if (!ready) {
            return;
        }
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
    }, [dataset.table, userSql, ready]);

    /**
     * Native fullscreen is taken on the document rather than the grid: only descendants
     * of the fullscreen element are drawn, and Mantine portals its tooltips, menus and
     * dialogs into the body. The grid's own fixed layer still hides the app chrome, so
     * the table is alone on a screen with no browser around it either.
     */
    const toggleFullscreen = useCallback(() => {
        const next = !fullscreen;
        setFullscreen(next);
        if (next) {
            // If the browser refuses, the fixed layer alone still fills the viewport.
            void document.documentElement.requestFullscreen?.().catch(() => undefined);
        } else if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => undefined);
        }
    }, [fullscreen]);

    // Leaving by Esc, F11 or the browser's own control has to bring the grid back too.
    useEffect(() => {
        const onChange = () => {
            if (!document.fullscreenElement) {
                setFullscreen(false);
            }
        };
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

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
            toggleFullscreen();
        };
        // Capture, because a tooltip on the focused control would otherwise swallow it.
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [fullscreen, toggleFullscreen]);

    const toggleSql = useCallback(() => {
        setSqlMounted(true);
        setSqlOpen((open) => !open);
    }, []);

    useShortcuts({
        [ShortcutId.ToggleSqlEditor]: toggleSql,
        [ShortcutId.ToggleFilters]: () => setShowFilters((shown) => !shown),
        [ShortcutId.ToggleColumns]: () => setColumnsOpen((shown) => !shown),
        [ShortcutId.ToggleFullscreen]: toggleFullscreen,
    });

    const clearSql = useCallback(() => {
        setSqlColumns(null);
        onViewStateChange((previous) => retargetViewState({ ...previous, sql: '' }, dataset.columns));
    }, [onViewStateChange, dataset.columns]);

    const applySql = useCallback(async (draft: string) => {
        const text = trimStatement(draft);
        if (!text) {
            clearSql();
            return;
        }
        const isQuery = RETURNS_ROWS.test(text);
        try {
            if (isQuery) {
                // DESCRIBE both validates the query and names its columns, without running it.
                const found = await describeQuery(text);
                setSqlColumns(found);
                onViewStateChange((previous) => retargetViewState({ ...previous, sql: text }, found));
            } else {
                notifyStatement(await execute(text));
                setRevision((r) => r + 1);
            }
        } catch (error) {
            failed(isQuery ? 'run that query' : 'run that statement', error);
        }
    }, [onViewStateChange, clearSql]);

    const renameColumn = useCallback((index: number, name: string) => {
        setLabels((prev) => prev.map((l, i) => (i === index ? name : l)));
    }, []);

    const updateCell = useCallback(async (rowId: number, column: string, previous: string, next: string) => {
        if (next === previous) {
            return;
        }
        try {
            await execute(updateCellSql(dataset.table, rowId, column, next));
            const [stored] = await query(cellSql(dataset.table, rowId, column));
            if (formatCell(stored?.[column]) === previous) {
                notifyUnchanged();
            }
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
                void updateCell(Number(row.original[ROW_ID]), key, formatCell(row.original[key]), e.currentTarget.value);
            },
        }),
        enableHiding: key !== lockedKey,
        minSize: columnMinSize(key, sample.map((row) => formatCell(row[key]))),
    })), [keys, labels, sample, lockedKey, renameColumn, updateCell]);

    const table = useMantineReactTable({
        columns,
        data: rows,
        // DuckDB does the filtering, sorting and paging; the grid is a window onto it.
        manualFiltering: true,
        manualSorting: true,
        manualPagination: true,
        rowCount: total,
        getRowId: (row, index) => String(row[ROW_ID] ?? index),
        enableColumnResizing: true,
        enableStickyHeader: true,
        enableFacetedValues: false,
        enableRowVirtualization: false,
        enableSortingRemoval: false,
        enableDensityToggle: false,
        enableFullScreenToggle: true,
        enableEditing: !userSql,
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
        mantineTableBodyProps: rows.length ? undefined : { mod: { empty: true } },
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
            isLoading: loading || !ready,
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
        renderTopToolbar: ({ table }) => (
            <>
                <MRT_TopToolbar table={table} />
                <Collapse className="sql-editor-collapse" in={sqlOpen} transitionDuration={SQL_EDITOR_SLIDE_MS}>
                    {sqlMounted && (
                        <Suspense fallback={<Box className="sql-editor-pending" />}>
                            <SqlEditor
                                value={viewState.sql}
                                alias={dataset.table}
                                columns={[ROW_ID, ...dataset.columns]}
                                onRun={(draft) => void applySql(draft)}
                                onClear={clearSql}
                            />
                        </Suspense>
                    )}
                </Collapse>
            </>
        ),
        renderTopToolbarCustomActions: () => <>{tabs}</>,
        renderBottomToolbarCustomActions: () => (
            <Text className="dataset-summary" c="dimmed" fz="xs" style={{ whiteSpace: 'nowrap' }}>
                {dataset.name} · {userSql ? `query · ${keys.length} cols` : `${dataset.rowCount.toLocaleString()} rows × ${keys.length} cols`}
            </Text>
        ),
        renderToolbarInternalActions: ({ table }) => (
            <Group gap={2} wrap="nowrap">
                <SearchBox table={table} />
                <MRT_ToggleFiltersButton table={table} />
                <ColumnsMenu table={table} opened={columnsOpen} onChange={setColumnsOpen} />
                <SqlToggle open={sqlOpen} active={!!userSql} onToggle={toggleSql} />
                <DensityToggle compact={compact} onToggle={() => setCompact((c) => !c)} />
                <FullscreenToggle active={fullscreen} onToggle={toggleFullscreen} />
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
