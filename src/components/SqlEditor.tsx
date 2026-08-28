import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror, { keymap, Prec, type Extension } from '@uiw/react-codemirror';
import { PostgreSQL, sql as sqlLang } from '@codemirror/lang-sql';
import { ActionIcon, Box, Stack, Tooltip, useComputedColorScheme } from '@mantine/core';
import { Eraser, Play } from 'lucide-react';

const HEIGHT = 132;

interface SqlEditorProps {
    /** The query currently driving the view; empty means the file's own table. */
    value: string;
    alias: string;
    columns: string[];
    onRun: (sql: string) => void;
    onClear: () => void;
}

export function SqlEditor({ value, alias, columns, onRun, onClear }: SqlEditorProps) {
    const [draft, setDraft] = useState(value);
    const scheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

    // The keymap closes over the draft once, so it reads the latest through a ref.
    const latest = useRef(draft);
    latest.current = draft;
    const run = useRef(onRun);
    run.current = onRun;

    // Switching views swaps the query underneath the box.
    useEffect(() => setDraft(value), [value]);

    const extensions = useMemo<Extension[]>(() => [
        // DuckDB's grammar is closest to Postgres. The schema is what turns this into
        // completion of real table and column names rather than bare keywords.
        sqlLang({
            dialect: PostgreSQL,
            schema: { [alias]: columns },
            defaultTable: alias,
            upperCaseKeywords: true,
        }),
        // Highest precedence so it beats the editor's own Enter handling.
        Prec.highest(keymap.of([{
            key: 'Mod-Enter',
            preventDefault: true,
            run: () => {
                run.current(latest.current);
                return true;
            },
        }])),
    ], [alias, columns]);

    return (
        <Box className="sql-editor">
            <Box className="sql-editor-code">
                <CodeMirror
                    value={draft}
                    height={`${HEIGHT}px`}
                    theme={scheme === 'dark' ? 'dark' : 'light'}
                    extensions={extensions}
                    placeholder={`SELECT * FROM ${alias} LIMIT 100`}
                    basicSetup={{
                        lineNumbers: false,
                        foldGutter: false,
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false,
                        autocompletion: true,
                    }}
                    onChange={setDraft}
                />
            </Box>
            <Stack gap={4} className="sql-editor-actions">
                <Tooltip label="Run (Ctrl+Enter)" withArrow position="left">
                    <ActionIcon variant="light" color="indigo" size="lg" aria-label="Run query" onClick={() => onRun(draft)}>
                        <Play size={18} />
                    </ActionIcon>
                </Tooltip>
                <Tooltip label="Clear query" withArrow position="left">
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="lg"
                        aria-label="Clear query"
                        onClick={() => { setDraft(''); onClear(); }}
                    >
                        <Eraser size={18} />
                    </ActionIcon>
                </Tooltip>
            </Stack>
        </Box>
    );
}
