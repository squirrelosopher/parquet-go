import { Modal, Text, Group, Button, Stack } from '@mantine/core';

interface ConfirmDialogProps {
    opened: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function ConfirmDialog({ opened, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onClose, onConfirm }: ConfirmDialogProps) {
    return (
        <Modal opened={opened} onClose={onClose} title={title} centered radius="md">
            <Stack gap="md">
                <Text fz="sm" c="dimmed">{message}</Text>
                <Group justify="flex-end" gap="sm">
                    <Button variant="default" onClick={onClose}>{cancelLabel}</Button>
                    <Button color={danger ? 'red' : undefined} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
                </Group>
            </Stack>
        </Modal>
    );
}
