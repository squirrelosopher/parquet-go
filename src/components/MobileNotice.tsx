import { Center, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { Monitor } from 'lucide-react';

const BADGE_SIZE = 56;
const GLYPH_SIZE = 28;

export function MobileNotice() {
    return (
        <Center className="mobile-notice" p="lg">
            <Stack align="center" gap="sm" maw={340}>
                <ThemeIcon variant="light" color="indigo" className="feature-badge" size={BADGE_SIZE} radius="md">
                    <Monitor size={GLYPH_SIZE} />
                </ThemeIcon>
                <Title order={2} fz="lg" fw={700} ta="center">ParquetGo needs a bigger screen</Title>
                <Text c="dimmed" fz="sm" ta="center">
                    The grid, SQL editor and column tools are built for a desktop browser. Open this page on a
                    larger screen to explore your Parquet files.
                </Text>
            </Stack>
        </Center>
    );
}
