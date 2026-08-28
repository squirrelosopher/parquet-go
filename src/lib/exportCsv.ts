export function downloadCsv(fileName: string, bytes: Uint8Array): void {
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName.replace(/\.[^.]+$/, '')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
