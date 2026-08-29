import type {
    MRT_ColumnFiltersState,
    MRT_ColumnOrderState,
    MRT_ColumnSizingState,
    MRT_PaginationState,
    MRT_SortingState,
    MRT_Updater,
    MRT_VisibilityState,
} from 'mantine-react-table';

/** A named lens over one file. Several views can target the same file. */
export interface View {
    id: string;
    fileId: string;
    name: string;
}

/**
 * Everything a view narrows the file by. Lifted out of the grid so each tab keeps
 * its own. Whether the filter row is *visible* is not here — that is a global
 * display mode, like the toolbar search.
 */
export interface ViewState {
    sorting: MRT_SortingState;
    columnFilters: MRT_ColumnFiltersState;
    /** The query this view reads from; empty means the file's own table. */
    sql: string;
    pagination: MRT_PaginationState;
    columnVisibility: MRT_VisibilityState;
    columnSizing: MRT_ColumnSizingState;
    columnOrder: MRT_ColumnOrderState;
}

const PAGE_SIZE = 25;

export function createViewState(columns: string[]): ViewState {
    return {
        sorting: columns.length ? [{ id: columns[0], desc: false }] : [],
        columnFilters: [],
        sql: '',
        pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
        columnVisibility: {},
        columnSizing: {},
        columnOrder: [],
    };
}

/**
 * A view stored by an older build is missing whatever has been added since, so it is
 * filled in from the current defaults rather than trusted as-is.
 */
export function normalizeViewState(stored: unknown): ViewState {
    const base = createViewState([]);
    if (!stored || typeof stored !== 'object') {
        return base;
    }
    const defined = Object.entries(stored as Record<string, unknown>).filter(([, v]) => v !== undefined);
    return { ...base, ...Object.fromEntries(defined) } as ViewState;
}

export function retargetViewState(state: ViewState, columns: string[]): ViewState {
    const available = new Set(columns);
    const sorting = state.sorting.filter((s) => available.has(s.id));
    const fallback = columns.length ? [{ id: columns[0], desc: false }] : [];
    return {
        ...state,
        columnFilters: state.columnFilters.filter((f) => available.has(String(f.id))),
        sorting: sorting.length ? sorting : fallback,
        pagination: { ...state.pagination, pageIndex: 0 },
    };
}

/**
 * Closing a view only costs the user something once they have narrowed it down.
 * The toolbar search is global, so it is not a view's to lose.
 */
export function hasFilters(state: ViewState | undefined): boolean {
    return !!state && state.columnFilters.length > 0;
}

/** Every view starts with the same name; renaming is how one gets a meaning. */
export const DEFAULT_VIEW_NAME = 'New view';

/** Table state setters hand back either a value or a reducer; normalise to a value. */
export function resolveUpdater<T>(updater: MRT_Updater<T>, previous: T): T {
    return typeof updater === 'function' ? (updater as (old: T) => T)(previous) : updater;
}
