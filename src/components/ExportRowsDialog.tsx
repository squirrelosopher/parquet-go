import { useEffect, useState } from 'react';
import { Modal, NumberInput, Switch, Group, Button, Stack } from '@mantine/core';
import type { CsvExportOptions } from '../lib/exportCsv';

interface ExportRowsDialogProps {
    opened: boolean;
    onClose: () => void;
    onSubmit: (options: CsvExportOptions) => void;
}

const DEFAULT_LIMIT = 1000;

export function ExportRowsDialog({ opened, onClose, onSubmit }: ExportRowsDialogProps) {
    const [limited, setLimited] = useState(false);
    const [limit, setLimit] = useState(DEFAULT_LIMIT);
    const [header, setHeader] = useState(true);

    useEffect(() => {
        if (opened) {
            setLimited(false);
            setLimit(DEFAULT_LIMIT);
            setHeader(true);
        }
    }, [opened]);

    const submit = () => {
        onSubmit({ limit: limited ? Math.max(1, limit) : undefined, header });
        onClose();
    };

    return (
        <Modal opened={opened} onClose={onClose} title="Export view" centered radius="md">
            <Stack gap="md">
                {/* One choice worn as two switches: turning either on turns the other off,
                    so both stay live rather than one going dead under the cursor. */}
                <Switch
                    label="Export all rows"
                    checked={!limited}
                    onChange={(e) => setLimited(!e.currentTarget.checked)}
                />
                <Switch
                    label="Export a set number of rows"
                    checked={limited}
                    onChange={(e) => setLimited(e.currentTarget.checked)}
                />
                <NumberInput
                    label="Number of rows"
                    min={1}
                    allowDecimal={false}
                    disabled={!limited}
                    value={limit}
                    onChange={(v) => setLimit(typeof v === 'number' ? v : 1)}
                />
                <Switch label="Include header row" checked={header} onChange={(e) => setHeader(e.currentTarget.checked)} />
                <Group justify="flex-end" gap="sm">
                    <Button variant="default" onClick={onClose}>Cancel</Button>
                    <Button onClick={submit}>Export</Button>
                </Group>
            </Stack>
        </Modal>
    );
}
