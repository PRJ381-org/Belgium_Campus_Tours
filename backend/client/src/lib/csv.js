/**
 * Minimal CSV reader for export previews. Skips the "# ..." header lines the
 * exports start with, and handles quoted cells (commas, "" and new lines).
 */
export function parseCsv(text, maxRows = Infinity) {
  const lines = text.split('\n').filter((l) => !l.startsWith('#'));
  const body = lines.join('\n').trim();

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < body.length && rows.length <= maxRows; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [header = [], ...data] = rows;
  return { header, rows: data.slice(0, maxRows) };
}
