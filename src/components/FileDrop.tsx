import { Dropzone } from '@mantine/dropzone';
import { Group, Text, Stack, ThemeIcon } from '@mantine/core';
import { UploadCloud, FileBox, X } from 'lucide-react';

const ACCEPT = {
    'application/vnd.apache.parquet': ['.parquet', '.pq'],
    'text/csv': ['.csv'],
    'text/plain': ['.tsv', '.txt'],
};

export function FileDrop({ onFile, compact = false }: { onFile: (file: File) => void; compact?: boolean }) {
    return (
        <Dropzone
            onDrop={(files) => files[0] && onFile(files[0])}
            accept={ACCEPT}
            multiple={false}
            radius="md"
            p={compact ? 'md' : 'xl'}
            style={{ maxWidth: 560, width: '100%' }}
        >
            <Group justify="center" gap={compact ? 'sm' : 'lg'} style={{ minHeight: compact ? 72 : 160, pointerEvents: 'none' }}>
                <Dropzone.Accept><Icon icon={UploadCloud} compact={compact} /></Dropzone.Accept>
                <Dropzone.Reject><Icon icon={X} color="red" compact={compact} /></Dropzone.Reject>
                <Dropzone.Idle><Icon icon={FileBox} color="gray" className="filedrop-idle" compact={compact} /></Dropzone.Idle>
                <Stack gap={2}>
                    <Text fw={600} fz={compact ? 'sm' : 'lg'}>Drop a {compact ? 'file' : 'Parquet or CSV file'}</Text>
                    <Text c="dimmed" fz="xs">or click to choose one</Text>
                </Stack>
            </Group>
        </Dropzone>
    );
}

function Icon({ icon: I, color = 'indigo', className, compact }: { icon: typeof UploadCloud; color?: string; className?: string; compact: boolean }) {
    return (
        <ThemeIcon variant="light" color={color} className={className} size={compact ? 40 : 64} radius="md">
            <I size={compact ? 20 : 30} />
        </ThemeIcon>
    );
}
