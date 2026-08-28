import Papa from 'papaparse';
import { formatCell } from './format';
import type { Row } from './types';

export interface ExportColumn {
    key: string;
    label: string;
}

export function exportCsv(fileName: string, columns: ExportColumn[], rows: Row[], header = true): void {
    const records = rows.map((row) => columns.map((c) => formatCell(row[c.key])));
    const csv = header ? Papa.unparse({ fields: columns.map((c) => c.label), data: records }) : Papa.unparse(records);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.replace(/\.[^.]+$/, '') + '.csv';
    link.click();
    URL.revokeObjectURL(url);
}
