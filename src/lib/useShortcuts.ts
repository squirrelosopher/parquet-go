import { useEffect, useRef } from 'react';
import { matchesCombo, SHORTCUTS, type ShortcutId } from './shortcuts';

type ShortcutHandlers = Partial<Record<ShortcutId, () => void>>;

export function useShortcuts(handlers: ShortcutHandlers): void {
    const latest = useRef(handlers);
    latest.current = handlers;

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            for (const shortcut of SHORTCUTS) {
                const handler = latest.current[shortcut.id];
                if (handler && matchesCombo(event, shortcut.combo)) {
                    event.preventDefault();
                    handler();
                    return;
                }
            }
        };

        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, []);
}
