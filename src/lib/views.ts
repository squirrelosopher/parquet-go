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
