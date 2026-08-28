import { Box, Group, Skeleton } from '@mantine/core';

const COLUMNS = 7;
/* The body clips what does not fit, so err high and let any viewport fill. */
const ROWS = 26;
/** Uneven widths so the placeholder reads as data rather than a pattern. */
const WIDTHS = ['70%', '45%', '85%', '55%', '75%', '40%', '65%'];

const cells = (count: number, offset: number, height: number) =>
    Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} radius="sm" width={WIDTHS[(i + offset) % WIDTHS.length]} />
    ));

/** Stands in for the grid while a file loads, in roughly the shape it will take. */
export function TableSkeleton() {
    return (
        <Box className="table-skeleton">
            <Group justify="space-between" px="md" h={56} wrap="nowrap" style={{ flex: 'none' }}>
                <Group gap={6} wrap="nowrap">
                    <Skeleton height={22} width={96} radius="sm" />
                    <Skeleton height={22} width={24} radius="sm" />
                </Group>
                <Group gap={6} wrap="nowrap">
                    {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={22} circle />)}
                </Group>
            </Group>

            <Box className="table-skeleton-head">{cells(COLUMNS, 0, 11)}</Box>

            <Box className="table-skeleton-body">
                {Array.from({ length: ROWS }, (_, row) => (
                    <Box key={row} className="table-skeleton-row">{cells(COLUMNS, row + 1, 9)}</Box>
                ))}
            </Box>

            <Group justify="space-between" px="md" h={48} wrap="nowrap" style={{ flex: 'none' }}>
                <Skeleton height={12} width={180} radius="sm" />
                <Skeleton height={12} width={220} radius="sm" />
            </Group>
        </Box>
    );
}
