import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { Group, Text, Stack, ThemeIcon, type MantineFontSize, type MantineSpacing } from '@mantine/core';
import { UploadCloud, FileBox, TriangleAlert } from 'lucide-react';
import { PARQUET_DROPZONE_ACCEPT } from '../lib/fileTypes';

export enum DropZoneLayout {
    Compact = 'compact',
    Full = 'full',
}

type FontSize = MantineFontSize | number;

interface LayoutSpec {
    title: string;
    titleSize: FontSize;
    hintSize: FontSize;
    padding: MantineSpacing;
    gap: MantineSpacing;
    minHeight: number;
    badgeSize: number;
    glyphSize: number;
}

const LAYOUT_SPECS: Record<DropZoneLayout, LayoutSpec> = {
    [DropZoneLayout.Compact]: {
        title: 'Drop a file',
        titleSize: 'sm',
        hintSize: 10,
        padding: 'sm',
        gap: 'xs',
        minHeight: 64,
        badgeSize: 32,
        glyphSize: 16,
    },
    [DropZoneLayout.Full]: {
        title: 'Drop a Parquet file',
        titleSize: 'lg',
        hintSize: 'xs',
        padding: 'xl',
        gap: 'lg',
        minHeight: 160,
        badgeSize: 64,
        glyphSize: 30,
    },
};

const MAX_ZONE_WIDTH = 560;
const UNSUPPORTED_NOTICE_MS = 6000;

export function notifyUnsupportedFile(): void {
    notifications.show({
        color: 'red',
        icon: <TriangleAlert size={18} />,
        title: 'File type not supported',
        message: 'Only .parquet and .pq can be opened.',
        autoClose: UNSUPPORTED_NOTICE_MS,
    });
}

interface FileDropProps {
    onFile: (file: File) => void;
    layout?: DropZoneLayout;
}

export function FileDrop({ onFile, layout = DropZoneLayout.Full }: FileDropProps) {
    const spec = LAYOUT_SPECS[layout];
    const armedBadge = <Badge icon={UploadCloud} spec={spec} />;

    return (
        <Dropzone
            onDrop={(files) => files[0] && onFile(files[0])}
            onReject={() => notifyUnsupportedFile()}
            accept={PARQUET_DROPZONE_ACCEPT}
            preventDropOnDocument
            multiple={false}
            radius="md"
            p={spec.padding}
            style={{ maxWidth: MAX_ZONE_WIDTH, width: '100%' }}
        >
            <Group
                justify="center"
                wrap="nowrap"
                gap={spec.gap}
                style={{ minHeight: spec.minHeight, pointerEvents: 'none' }}
            >
                <Dropzone.Accept>{armedBadge}</Dropzone.Accept>
                <Dropzone.Reject>{armedBadge}</Dropzone.Reject>
                <Dropzone.Idle><Badge icon={FileBox} spec={spec} /></Dropzone.Idle>
                <Prompt spec={spec} />
            </Group>
        </Dropzone>
    );
}

function Prompt({ spec }: { spec: LayoutSpec }) {
    return (
        <Stack className="filedrop-prompt" gap={2}>
            <Text fw={600} fz={spec.titleSize}>{spec.title}</Text>
            <Text className="filedrop-hint" c="dimmed" fz={spec.hintSize}>
                or <span className="filedrop-hint-action">click to choose one</span>
            </Text>
        </Stack>
    );
}

interface BadgeProps {
    icon: typeof UploadCloud;
    spec: LayoutSpec;
}

function Badge({ icon: Glyph, spec }: BadgeProps) {
    return (
        <ThemeIcon variant="light" color="gray" className="filedrop-badge" size={spec.badgeSize} radius="md" style={{ flex: 'none' }}>
            <Glyph size={spec.glyphSize} />
        </ThemeIcon>
    );
}
