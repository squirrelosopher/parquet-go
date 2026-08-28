import { ActionIcon, Tooltip } from '@mantine/core';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

interface DensityToggleProps {
    compact: boolean;
    onToggle: () => void;
}

export function DensityToggle({ compact, onToggle }: DensityToggleProps) {
    const Icon = compact ? ChevronsUpDown : ChevronsDownUp;
    const label = compact ? 'Comfortable rows' : 'Compact rows';

    return (
        <Tooltip label={label} withArrow>
            <ActionIcon variant="subtle" color="gray" size="lg" onClick={onToggle} aria-label={label}>
                <Icon size={18} />
            </ActionIcon>
        </Tooltip>
    );
}
