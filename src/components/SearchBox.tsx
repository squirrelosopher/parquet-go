import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Box, Tooltip } from '@mantine/core';
import { Search, X } from 'lucide-react';
import type { MRT_TableInstance } from 'mantine-react-table';
import type { Row } from '../lib/types';

const OPEN_WIDTH = 240;
const SLOT = 34;

export function SearchBox({ table }: { table: MRT_TableInstance<Row> }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const applied = (table.getState().globalFilter as string | undefined) ?? '';

    useEffect(() => {
        if (open) {
            inputRef.current?.focus();
        }
    }, [open]);

    // The search is global and can be reset from outside (switching file); keep the
    // box in step. Typing only diverges until Enter, which lands on this same value.
    useEffect(() => setDraft(applied), [applied]);

    const close = () => {
        setDraft('');
        table.setGlobalFilter('');
        setOpen(false);
    };

    return (
        <Box className="search-box" data-open={open} style={{ width: open ? OPEN_WIDTH : SLOT }}>
            <input
                ref={inputRef}
                className="search-box-input"
                placeholder="Search"
                value={draft}
                tabIndex={open ? 0 : -1}
                aria-hidden={!open}
                onChange={(e) => setDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        table.setGlobalFilter(draft);
                    } else if (e.key === 'Escape') {
                        close();
                    }
                }}
            />
            <Tooltip label={open ? 'Close search' : 'Search'} withArrow>
                <ActionIcon
                    className="search-box-toggle"
                    variant="subtle"
                    color="gray"
                    size="lg"
                    aria-label={open ? 'Close search' : 'Search'}
                    onClick={() => (open ? close() : setOpen(true))}
                >
                    {open ? <X size={18} /> : <Search size={18} />}
                </ActionIcon>
            </Tooltip>
        </Box>
    );
}
