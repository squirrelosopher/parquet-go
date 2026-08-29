import { Modal, SimpleGrid, Group, Text, Kbd } from '@mantine/core';
import { X } from 'lucide-react';
import { comboLabels, SHORTCUTS } from '../lib/shortcuts';

interface ShortcutsDialogProps {
    opened: boolean;
    onClose: () => void;
}

export function ShortcutsDialog({ opened, onClose }: ShortcutsDialogProps) {
    return (
        <Modal
            className="shortcuts-modal"
            opened={opened}
            onClose={onClose}
            title="Keyboard shortcuts"
            centered
            radius="md"
            size="lg"
            overlayProps={{ backgroundOpacity: 0.4, blur: 3 }}
            closeButtonProps={{ icon: <X size={18} /> }}
        >
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" verticalSpacing={6}>
                {SHORTCUTS.map((shortcut) => (
                    <Group key={shortcut.id} justify="space-between" gap="sm" wrap="nowrap">
                        <Text fz="sm">{shortcut.label}</Text>
                        <Group gap={4} wrap="nowrap">
                            {comboLabels(shortcut).map((key) => <Kbd key={key} size="xs">{key}</Kbd>)}
                        </Group>
                    </Group>
                ))}
            </SimpleGrid>
        </Modal>
    );
}
