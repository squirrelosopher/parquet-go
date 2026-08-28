import { ActionIcon, Tooltip } from '@mantine/core';
import { Terminal } from 'lucide-react';

interface SqlToggleProps {
    open: boolean;
    active: boolean;
    onToggle: () => void;
}

export function SqlToggle({ open, active, onToggle }: SqlToggleProps) {
    const label = open ? 'Hide SQL editor' : 'SQL editor';

    return (
        <Tooltip label={label} withArrow>
            <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                aria-label={label}
                aria-pressed={open}
                onClick={onToggle}
                // A query still driving the view is worth seeing with the box closed.
                className={active ? 'sql-toggle-active' : undefined}
            >
                <Terminal size={18} />
            </ActionIcon>
        </Tooltip>
    );
}
