import { createTheme, Select } from '@mantine/core';

const FONT = "'Noto Sans Variable', system-ui, -apple-system, 'Segoe UI', sans-serif";

export const theme = createTheme({
    primaryColor: 'indigo',
    defaultRadius: 'md',
    cursorType: 'pointer',
    fontFamily: FONT,
    headings: { fontFamily: FONT },
    components: {
        Select: Select.extend({ defaultProps: { withCheckIcon: false, size: 'sm' } }),
    },
});
