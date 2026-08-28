import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Box, TextInput, Tooltip } from '@mantine/core';
import { Search, X } from 'lucide-react';
import type { MRT_TableInstance } from 'mantine-react-table';
import type { Row } from '../lib/types';

const OPEN_WIDTH = 240;
const SLOT = 34;
const INPUT_PAD = 36;

export function SearchBox({ table }: { table: MRT_TableInstance<Row> }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            inputRef.current?.focus();
        }
    }, [open]);

    const toggle = () => {
        if (open) {
            setDraft('');
            table.setGlobalFilter('');
            setOpen(false);
            return;
        }
        setOpen(true);
    };

    return (
        <Box style={{ position: 'relative', width: SLOT, height: SLOT, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Box style={{ position: 'absolute', right: 0, width: open ? OPEN_WIDTH : 0, overflow: 'hidden', transition: 'width 0.2s ease' }}>
                <TextInput
                    ref={inputRef}
                    size="sm"
                    placeholder="Search"
                    value={draft}
                    onChange={(e) => setDraft(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            table.setGlobalFilter(draft || undefined);
                        } else if (e.key === 'Escape') {
                            toggle();
                        }
                    }}
                    style={{ width: OPEN_WIDTH }}
                    styles={{ input: { paddingRight: INPUT_PAD } }}
                />
            </Box>
            <Tooltip label={open ? 'Close search' : 'Search'} withArrow>
                <ActionIcon style={{ position: 'absolute', right: 0 }} variant="subtle" color="gray" size="lg" onClick={toggle} aria-label={open ? 'Close search' : 'Search'}>
                    {open ? <X size={18} /> : <Search size={18} />}
                </ActionIcon>
            </Tooltip>
        </Box>
    );
}
