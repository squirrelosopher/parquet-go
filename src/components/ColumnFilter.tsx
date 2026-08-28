import { useState } from 'react';
import { ActionIcon, TextInput } from '@mantine/core';
import { X } from 'lucide-react';
import type { MRT_Column } from 'mantine-react-table';
import type { Row } from '../lib/types';

interface ColumnFilterProps {
    column: MRT_Column<Row>;
    placeholder: string;
}

export function ColumnFilter({ column, placeholder }: ColumnFilterProps) {
    const [draft, setDraft] = useState((column.getFilterValue() as string) ?? '');

    const clear = () => {
        setDraft('');
        column.setFilterValue(undefined);
    };

    return (
        <TextInput
            variant="unstyled"
            size="xs"
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && column.setFilterValue(draft || undefined)}
            rightSection={draft ? (
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={clear} aria-label="Clear filter">
                    <X size={14} />
                </ActionIcon>
            ) : null}
        />
    );
}
