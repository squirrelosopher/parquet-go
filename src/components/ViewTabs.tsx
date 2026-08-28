import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Box, Menu, Tooltip } from '@mantine/core';
import { ArrowLeftToLine, CircleX, Plus, SquareX, X } from 'lucide-react';
import type { View } from '../lib/views';

const VIEW_NAME_MAX = 10;

interface ViewTabsProps {
    views: View[];
    activeId: string | null;
    onSelect: (view: View) => void;
    onClose: (view: View) => void;
    onCloseAll: () => void;
    onCloseAllExcept: (view: View) => void;
    onCloseToTheLeft: (view: View) => void;
    onRename: (view: View, name: string) => void;
    onAdd: () => void;
}

interface MenuState {
    view: View;
    x: number;
    y: number;
}

/** While renaming, the tab keeps the width it already had so the strip never jumps. */
interface EditState {
    id: string;
    width: number;
}

export function ViewTabs({ views, activeId, onSelect, onClose, onCloseAll, onCloseAllExcept, onCloseToTheLeft, onRename, onAdd }: ViewTabsProps) {
    const [menu, setMenu] = useState<MenuState | null>(null);
    const [editing, setEditing] = useState<EditState | null>(null);
    const [draft, setDraft] = useState('');
    const stripRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<HTMLElement | null>(null);
    const closable = views.length > 1;

    // Keep the selected view on screen — a newly added one sits past the right edge
    // once the strip is full, so the older tabs have to slide out of sight.
    useEffect(() => {
        const strip = stripRef.current;
        const tab = activeRef.current;
        if (!strip || !tab) {
            return;
        }
        const stripBox = strip.getBoundingClientRect();
        const tabBox = tab.getBoundingClientRect();
        if (tabBox.left < stripBox.left) {
            strip.scrollLeft -= stripBox.left - tabBox.left;
        } else if (tabBox.right > stripBox.right) {
            strip.scrollLeft += tabBox.right - stripBox.right;
        }
    }, [activeId, views.length]);

    const startEditing = (view: View, tab: HTMLElement) => {
        setEditing({ id: view.id, width: tab.getBoundingClientRect().width });
        setDraft(view.name);
    };

    const commit = (view: View) => {
        const name = draft.trim();
        if (name && name !== view.name) {
            onRename(view, name);
        }
        setEditing(null);
    };

    const menuIndex = menu ? views.findIndex((v) => v.id === menu.view.id) : -1;

    return (
        <Box className="view-tabs">
            <Box
                ref={stripRef}
                className="view-tabs-strip"
                // A vertical wheel walks the strip sideways, as in a browser tab bar.
                onWheel={(e) => {
                    const strip = e.currentTarget;
                    if (strip.scrollWidth > strip.clientWidth) {
                        strip.scrollLeft += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
                    }
                }}
            >
                {views.map((view) => (
                    view.id === editing?.id ? (
                        // An input cannot live inside a button, so editing swaps the tab
                        // for a plain box pinned to the width it was already rendered at.
                        <Box
                            key={view.id}
                            className="view-tab"
                            data-active={view.id === activeId}
                            data-editing="true"
                            style={{ width: editing.width }}
                        >
                            <input
                                className="view-tab-input"
                                autoFocus
                                value={draft}
                                maxLength={VIEW_NAME_MAX}
                                onChange={(e) => setDraft(e.currentTarget.value)}
                                onFocus={(e) => e.currentTarget.select()}
                                onBlur={() => commit(view)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        commit(view);
                                    } else if (e.key === 'Escape') {
                                        setEditing(null);
                                    }
                                }}
                            />
                        </Box>
                    ) : (
                        <Tooltip key={view.id} label={view.name} withArrow position="top" openDelay={400} floatingStrategy="fixed" middlewares={{ flip: false, shift: true, inline: false }}>
                            <Box
                                component="button"
                                type="button"
                                ref={(el: HTMLElement | null) => {
                                    if (view.id === activeId) {
                                        activeRef.current = el;
                                    }
                                }}
                                className="view-tab"
                                data-active={view.id === activeId}
                                onClick={() => onSelect(view)}
                                onDoubleClick={(e) => startEditing(view, e.currentTarget)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setMenu({ view, x: e.clientX, y: e.clientY });
                                }}
                                // Middle-click closes, as in a browser. Suppressing mousedown keeps
                                // Chrome from switching to its autoscroll cursor first.
                                onMouseDown={(e) => e.button === 1 && e.preventDefault()}
                                onAuxClick={(e) => {
                                    if (e.button === 1 && closable) {
                                        e.preventDefault();
                                        onClose(view);
                                    }
                                }}
                            >
                                <span className="view-tab-label">{view.name}</span>
                                {closable && (
                                    <Box
                                        component="span"
                                        role="button"
                                        tabIndex={-1}
                                        aria-label={`Close ${view.name}`}
                                        className="view-tab-close"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClose(view);
                                        }}
                                    >
                                        <X size={12} />
                                    </Box>
                                )}
                            </Box>
                        </Tooltip>
                    )
                ))}
            </Box>
            <Tooltip label="New view of this file" withArrow>
                <ActionIcon variant="subtle" color="gray" size="md" onClick={onAdd} aria-label="New view">
                    <Plus size={16} />
                </ActionIcon>
            </Tooltip>

            {menu && (
                <Menu opened onClose={() => setMenu(null)} withinPortal position="right-start" offset={2}>
                    <Menu.Target>
                        <div style={{ position: 'fixed', left: menu.x, top: menu.y, width: 1, height: 1 }} />
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Item
                            leftSection={<X size={14} />}
                            disabled={!closable}
                            onClick={() => { onClose(menu.view); setMenu(null); }}
                        >
                            Close
                        </Menu.Item>
                        <Menu.Item
                            leftSection={<SquareX size={14} />}
                            disabled={views.length <= 1}
                            onClick={() => { onCloseAllExcept(menu.view); setMenu(null); }}
                        >
                            Close All Except
                        </Menu.Item>
                        <Menu.Item
                            leftSection={<ArrowLeftToLine size={14} />}
                            disabled={menuIndex <= 0}
                            onClick={() => { onCloseToTheLeft(menu.view); setMenu(null); }}
                        >
                            Close Views to the Left
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                            leftSection={<CircleX size={14} />}
                            onClick={() => { onCloseAll(); setMenu(null); }}
                        >
                            Close All
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            )}
        </Box>
    );
}
