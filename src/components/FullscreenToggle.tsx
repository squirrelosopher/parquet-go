import { ActionIcon, Tooltip } from '@mantine/core';
import { Maximize2, Minimize2 } from 'lucide-react';

interface FullscreenToggleProps {
    active: boolean;
    onToggle: () => void;
}

export function FullscreenToggle({ active, onToggle }: FullscreenToggleProps) {
    const Icon = active ? Minimize2 : Maximize2;
    const label = active ? 'Exit fullscreen (Esc)' : 'Fullscreen table';

    return (
        <Tooltip label={label} withArrow>
            <ActionIcon variant="subtle" color="gray" size="lg" onClick={onToggle} aria-label={label}>
                <Icon size={18} />
            </ActionIcon>
        </Tooltip>
    );
}
