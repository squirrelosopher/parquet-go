import { useRef, useState } from 'react';
import { Box } from '@mantine/core';

export const SIDEBAR_DEFAULT_WIDTH = 280;
export const SIDEBAR_FLOOR_WIDTH = 256;
const SIDEBAR_PREFERRED_MAX_WIDTH = 520;

const clampWidth = (width: number, minWidth: number) =>
    Math.min(Math.max(SIDEBAR_PREFERRED_MAX_WIDTH, minWidth), Math.max(minWidth, width));

interface SidebarResizerProps {
    width: number;
    minWidth: number;
    onResize: (width: number) => void;
    onDragChange: (dragging: boolean) => void;
}

export function SidebarResizer({ width, minWidth, onResize, onDragChange }: SidebarResizerProps) {
    const [dragging, setDragging] = useState(false);
    const dragOrigin = useRef({ pointerX: 0, width: 0 });

    const changeDragging = (active: boolean) => {
        setDragging(active);
        onDragChange(active);
    };

    return (
        <Box
            className="sidebar-resizer"
            data-dragging={dragging}
            role="separator"
            aria-orientation="vertical"
            onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                dragOrigin.current = { pointerX: e.clientX, width };
                changeDragging(true);
            }}
            onPointerMove={(e) => {
                if (!dragging) {
                    return;
                }
                const dragged = dragOrigin.current.width + e.clientX - dragOrigin.current.pointerX;
                onResize(clampWidth(dragged, minWidth));
            }}
            onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId);
                changeDragging(false);
            }}
        />
    );
}
