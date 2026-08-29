# ParquetGo

A fast **Parquet explorer** that runs entirely in the browser. Drag a file in (or click to
choose one) and get a sortable, filterable, searchable grid. Nothing is uploaded; the file
is read locally. Export the current view back to CSV.

- **Parquet** read and queried with [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview).
  Filtering, sorting, paging and export all run in the engine, so only one page of rows
  ever reaches the grid
- Multiple files and per-file view tabs, each keeping its own filters, sorting and layout
- A SQL editor ([CodeMirror](https://codemirror.net/)) for querying the loaded file directly
- Grid, toolbar (search / filter / columns / density / fullscreen), and theming by
  [Mantine](https://mantine.dev) + [Mantine React Table](https://www.mantine-react-table.com/)
- Keyboard shortcuts for opening, exporting, filtering, columns, fullscreen and SQL
  (press `Ctrl`/`⌘` + `/` for the full list)
- Light/dark theme, no backend, nothing leaves the machine

Only `.parquet` and `.pq` files are accepted; anything else is refused with a message.
The grid is built for a desktop browser and asks small touch screens for a bigger one.

## Run

```bash
npm install
npm run dev            # http://localhost:5173
```

## Build

```bash
npm run build          # static output in dist/
```

Deploy `dist/` to any static host (GitHub Pages, etc.).

## License

MIT, see [LICENSE](LICENSE).
