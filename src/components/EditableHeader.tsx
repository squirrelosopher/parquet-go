import { useEffect, useRef, useState } from 'react';
import { TextInput, Text } from '@mantine/core';

interface EditableHeaderProps {
    label: string;
    maxLength: number;
    onRename: (name: string) => void;
    onSort: () => void;
}

const CLICK_DELAY = 200;

export function EditableHeader({ label, maxLength, onRename, onSort }: EditableHeaderProps) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(label);
    const timer = useRef<number>();

    useEffect(() => setValue(label), [label]);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    const commit = () => {
        onRename(value);
        setEditing(false);
    };

    if (editing) {
        return (
            <TextInput
                variant="unstyled"
                size="sm"
                autoFocus
                value={value}
                maxLength={maxLength}
                onChange={(e) => setValue(e.currentTarget.value)}
                onBlur={commit}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        commit();
                    } else if (e.key === 'Escape') {
                        setValue(label);
                        setEditing(false);
                    }
                }}
                styles={{ input: { fontWeight: 600, fontSize: 'var(--mantine-font-size-sm)', height: 'auto', minHeight: 0, padding: 0, lineHeight: 'inherit', backgroundColor: 'var(--mantine-color-default-hover)' } }}
            />
        );
    }

    return (
        <Text
            component="span"
            fw={600}
            onClick={(e) => {
                e.stopPropagation();
                if (e.detail === 1) {
                    timer.current = window.setTimeout(onSort, CLICK_DELAY);
                }
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                window.clearTimeout(timer.current);
                setEditing(true);
            }}
        >
            {label || ' '}
        </Text>
    );
}
