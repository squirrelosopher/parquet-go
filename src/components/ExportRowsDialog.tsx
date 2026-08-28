import { useEffect, useState } from 'react';
import { Modal, NumberInput, Switch, Group, Button, Stack } from '@mantine/core';

export interface ExportRowsOptions {
    limit: number;
    header: boolean;
}

interface ExportRowsDialogProps {
    opened: boolean;
    onClose: () => void;
    onSubmit: (options: ExportRowsOptions) => void;
}

const DEFAULT_LIMIT = 100;

export function ExportRowsDialog({ opened, onClose, onSubmit }: ExportRowsDialogProps) {
    const [limit, setLimit] = useState(DEFAULT_LIMIT);
    const [header, setHeader] = useState(true);

    useEffect(() => {
        if (opened) {
            setLimit(DEFAULT_LIMIT);
            setHeader(true);
        }
    }, [opened]);

    const submit = () => {
        onSubmit({ limit: Math.max(1, limit), header });
        onClose();
    };

    return (
        <Modal opened={opened} onClose={onClose} title="Export rows" centered radius="md">
            <Stack gap="md">
                <NumberInput
                    label="Number of rows"
                    min={1}
                    allowDecimal={false}
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
