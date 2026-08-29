const PARQUET_EXTENSIONS = ['.parquet', '.pq'];

export const PARQUET_DROPZONE_ACCEPT = {
    'application/vnd.apache.parquet': PARQUET_EXTENSIONS,
};

export const PARQUET_FILE_PICKER_ACCEPT = PARQUET_EXTENSIONS.join(',');

export const isParquet = (fileName: string): boolean =>
    PARQUET_EXTENSIONS.some((extension) => fileName.toLowerCase().endsWith(extension));
