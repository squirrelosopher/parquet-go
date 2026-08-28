import { useEffect, useState } from 'react';
import { Modal, TextInput, Group, Button, Stack } from '@mantine/core';

interface RenameDialogProps {
    opened: boolean;
    initialName: string;
    onClose: () => void;
    onSubmit: (name: string) => void;
}

export function RenameDialog({ opened, initialName, onClose, onSubmit }: RenameDialogProps) {
    const [value, setValue] = useState(initialName);

    useEffect(() => {
        if (opened) {
            setValue(initialName);
        }
    }, [opened, initialName]);

    const submit = () => {
        const name = value.trim();
        if (name) {
            onSubmit(name);
            onClose();
        }
    };

    return (
        <Modal opened={opened} onClose={onClose} title="Rename file" centered radius="md">
            <Stack gap="md">
                <TextInput
                    label="Name"
                    value={value}
                    data-autofocus
                    onChange={(e) => setValue(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
                <Group justify="flex-end" gap="sm">
                    <Button variant="default" onClick={onClose}>Cancel</Button>
                    <Button onClick={submit}>Rename</Button>
                </Group>
            </Stack>
        </Modal>
    );
}
