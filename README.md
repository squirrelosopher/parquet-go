# ParquetGo

A fast, read-only **Parquet / CSV viewer** that runs entirely in the browser — drag a file
in (or click to choose one) and get a sortable, filterable, searchable grid. Nothing is
uploaded; the file is read locally. Export the current view back to CSV.

- **Parquet** read with [hyparquet](https://github.com/hyparam/hyparquet)
- **CSV** parsed with [PapaParse](https://www.papaparse.com/)
- Grid, toolbar (search / filter / columns / density / fullscreen), and theming by
  [Mantine](https://mantine.dev) + [Mantine React Table](https://www.mantine-react-table.com/)
- Light/dark theme, responsive, no backend

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

MIT — see [LICENSE](LICENSE).
