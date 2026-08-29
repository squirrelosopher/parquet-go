import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@fontsource-variable/noto-sans';
import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/notifications/styles.css';
import 'mantine-react-table/styles.css';
import './index.css';
import { theme } from './theme';
import { App } from './App';
import { MobileNotice } from './components/MobileNotice';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <ColorSchemeScript defaultColorScheme="light" />
        <MantineProvider theme={theme} defaultColorScheme="light">
            <Notifications position="top-right" transitionDuration={250} />
            <MobileNotice />
            <App />
        </MantineProvider>
    </React.StrictMode>,
);
