import { SimpleGrid, Stack, Text, ThemeIcon, Group } from '@mantine/core';
import { Terminal, Filter, Pencil, Download } from 'lucide-react';

interface Feature {
    icon: typeof Terminal;
    title: string;
    description: string;
}

const FEATURES: Feature[] = [
    {
        icon: Terminal,
        title: 'SQL editor',
        description: 'Query the file with DuckDB SQL. Autocompletion support for tables and columns.',
    },
    {
        icon: Filter,
        title: 'Filter and search',
        description: 'Narrow one column at a time, or search across every column at once.',
    },
    {
        icon: Pencil,
        title: 'View and edit',
        description: 'Page through millions of rows, edit and update data in place.',
    },
    {
        icon: Download,
        title: 'Export what you see',
        description: 'Create tailored selections and send them to CSV, every row or a set number.',
    },
];

const BADGE_SIZE = 32;
const GLYPH_SIZE = 16;

export function FeatureGrid() {
    return (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="md" w="100%">
            {FEATURES.map(({ icon: Glyph, title, description }) => (
                <Group key={title} align="flex-start" gap="sm" wrap="nowrap">
                    <ThemeIcon variant="light" color="indigo" className="feature-badge" size={BADGE_SIZE} radius="md" style={{ flex: 'none' }}>
                        <Glyph size={GLYPH_SIZE} />
                    </ThemeIcon>
                    <Stack gap={2}>
                        <Text fw={600} fz="sm">{title}</Text>
                        <Text c="dimmed" fz="xs">{description}</Text>
                    </Stack>
                </Group>
            ))}
        </SimpleGrid>
    );
}
