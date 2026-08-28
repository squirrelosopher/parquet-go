import { Collapse, createTheme, Select } from '@mantine/core';

const FONT = "'Noto Sans Variable', system-ui, -apple-system, 'Segoe UI', sans-serif";

export const theme = createTheme({
    primaryColor: 'indigo',
    defaultRadius: 'md',
    cursorType: 'pointer',
    // Drops Mantine's translateY(1px) press effect on every button. Empty string
    // means "no active class", which is the supported way to opt out globally.
    activeClassName: '',
    fontFamily: FONT,
    headings: { fontFamily: FONT },
    components: {
        Select: Select.extend({ defaultProps: { withCheckIcon: false, size: 'sm' } }),
        // The only Collapse here is the grid's column-filter row. Animating its height
        // uncovers the inputs' text before the space beneath them, which reads as a snap;
        // the row is better off just being there.
        Collapse: Collapse.extend({ defaultProps: { transitionDuration: 0 } }),
    },
});
