export enum ShortcutId {
    OpenFile = 'openFile',
    ExportView = 'exportView',
    ToggleSidebar = 'toggleSidebar',
    ToggleFullscreen = 'toggleFullscreen',
    ToggleFilters = 'toggleFilters',
    ToggleColumns = 'toggleColumns',
    ToggleSqlEditor = 'toggleSqlEditor',
    RunQuery = 'runQuery',
    ShowShortcuts = 'showShortcuts',
}

interface Combo {
    key: string;
    shift?: boolean;
}

interface Shortcut {
    id: ShortcutId;
    label: string;
    combo: Combo;
}

export const SHORTCUTS: Shortcut[] = [
    { id: ShortcutId.OpenFile, label: 'Open a Parquet file', combo: { key: 'o' } },
    { id: ShortcutId.ExportView, label: 'Export view to CSV', combo: { key: 's' } },
    { id: ShortcutId.ToggleSidebar, label: 'Show or hide the files sidebar', combo: { key: 'b' } },
    { id: ShortcutId.ToggleFullscreen, label: 'Enter or leave fullscreen', combo: { key: 'x', shift: true } },
    { id: ShortcutId.ToggleFilters, label: 'Show or hide the filter row', combo: { key: 'm' } },
    { id: ShortcutId.ToggleColumns, label: 'Show or hide columns', combo: { key: 'l', shift: true } },
    { id: ShortcutId.ToggleSqlEditor, label: 'Show or hide the SQL editor', combo: { key: 'e' } },
    { id: ShortcutId.RunQuery, label: 'Run the query in the SQL editor', combo: { key: 'Enter' } },
    { id: ShortcutId.ShowShortcuts, label: 'Show keyboard shortcuts', combo: { key: '/' } },
];

const APPLE_PLATFORM = /Mac|iPhone|iPad|iPod/;

const isApplePlatform = (): boolean =>
    APPLE_PLATFORM.test(navigator.platform) || APPLE_PLATFORM.test(navigator.userAgent);

const MOD_LABEL = isApplePlatform() ? '⌘' : 'Ctrl';
const SHIFT_LABEL = isApplePlatform() ? '⇧' : 'Shift';

const KEY_LABELS: Record<string, string> = {
    Enter: '↵',
};

export function comboLabels({ combo }: Shortcut): string[] {
    const keys = [MOD_LABEL];
    if (combo.shift) {
        keys.push(SHIFT_LABEL);
    }
    return [...keys, KEY_LABELS[combo.key] ?? combo.key.toUpperCase()];
}

export function matchesCombo(event: KeyboardEvent, combo: Combo): boolean {
    const modPressed = isApplePlatform() ? event.metaKey : event.ctrlKey;
    return modPressed
        && !event.altKey
        && event.shiftKey === !!combo.shift
        && event.key.toLowerCase() === combo.key.toLowerCase();
}

export const isShortcut = (event: KeyboardEvent): boolean =>
    SHORTCUTS.some((shortcut) => matchesCombo(event, shortcut.combo));
