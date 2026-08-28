import { Group, Text, ActionIcon, FileButton, Tooltip, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { FileBox, Coffee, Sun, Moon, PanelLeft, Download } from 'lucide-react';

const GITHUB_URL = 'https://github.com/squirrelosopher';
const COFFEE_URL = 'https://buymeacoffee.com/squirrelosopher';
const OPEN_ACCEPT = '.parquet,.pq,.csv,.tsv,.txt';

interface HeaderProps {
    onToggleSidebar?: () => void;
    onOpen?: (file: File) => void;
    onExport?: () => void;
}

export function Header({ onToggleSidebar, onOpen, onExport }: HeaderProps) {
    const { setColorScheme } = useMantineColorScheme();
    const scheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
    const ThemeIcon = scheme === 'dark' ? Sun : Moon;

    return (
        <Group justify="space-between" align="center" px="md" h={56} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            {onToggleSidebar ? (
                <Group gap="xs">
                    <Tooltip label="Toggle files sidebar" withArrow>
                        <ActionIcon variant="default" size="lg" aria-label="Toggle files sidebar" onClick={onToggleSidebar}>
                            <PanelLeft size={18} />
                        </ActionIcon>
                    </Tooltip>
                    <FileButton onChange={(file) => file && onOpen?.(file)} accept={OPEN_ACCEPT}>
                        {(props) => (
                            <Tooltip label="Open a Parquet or CSV file" withArrow>
                                <ActionIcon {...props} variant="default" size="lg" aria-label="Open a file"><FileBox size={18} /></ActionIcon>
                            </Tooltip>
                        )}
                    </FileButton>
                    <Tooltip label="Export current view to CSV" withArrow>
                        <ActionIcon variant="default" size="lg" aria-label="Export CSV" onClick={onExport} disabled={!onExport}><Download size={18} /></ActionIcon>
                    </Tooltip>
                </Group>
            ) : (
                <Group gap="xs" align="center">
                    <FileBox size={20} color="var(--mantine-color-indigo-5)" />
                    <Text fw={700} fz="md">ParquetGo</Text>
                </Group>
            )}
            <Group gap="xs">
                <Tooltip label="View source on GitHub" withArrow>
                    <ActionIcon component="a" href={GITHUB_URL} target="_blank" rel="noopener noreferrer" variant="default" size="lg" aria-label="GitHub">
                        <GithubMark size={18} />
                    </ActionIcon>
                </Tooltip>
                <Tooltip label="Buy me a coffee" withArrow>
                    <ActionIcon component="a" href={COFFEE_URL} target="_blank" rel="noopener noreferrer" variant="default" size="lg" aria-label="Buy me a coffee">
                        <Coffee size={18} />
                    </ActionIcon>
                </Tooltip>
                <Tooltip label={scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} withArrow>
                    <ActionIcon variant="default" size="lg" aria-label="Toggle color scheme" onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}>
                        <ThemeIcon size={18} />
                    </ActionIcon>
                </Tooltip>
            </Group>
        </Group>
    );
}

function GithubMark({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.37-1.34-1.74-1.34-1.74-1.09-.73.08-.72.08-.72 1.2.08 1.83 1.21 1.83 1.21 1.07 1.79 2.81 1.27 3.5.97.11-.76.42-1.27.76-1.56-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21.96-.26 1.98-.39 3-.4 1.02 0 2.04.14 3 .4 2.28-1.53 3.29-1.21 3.29-1.21.66 1.64.24 2.86.12 3.16.77.83 1.24 1.88 1.24 3.17 0 4.53-2.81 5.53-5.49 5.82.43.36.81 1.09.81 2.19 0 1.58-.01 2.86-.01 3.25 0 .31.21.68.83.56C20.56 21.88 24 17.48 24 12.29 24 5.78 18.63.5 12 .5z" />
        </svg>
    );
}
