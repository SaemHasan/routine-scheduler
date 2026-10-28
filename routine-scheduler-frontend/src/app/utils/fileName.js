const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "July-26" → "July 2026", as the routines write a term
export function termTitle(session) {
  const m = /^([A-Za-z]+)[-\s]*(\d{2,4})$/.exec(String(session || "").trim());
  if (!m) return String(session || "");
  const month = MONTHS.find((name) => name.slice(0, 3).toLowerCase() === m[1].slice(0, 3).toLowerCase()) || m[1];
  return `${month} ${m[2].length === 2 ? `20${m[2]}` : m[2]}`;
}

/**
 * What a downloaded file is called, like the routine PDFs: its type, the
 * term and today's date, e.g. "Theory_Distribution_July_2026_29_October_2026.csv".
 */
export function downloadName(type, session, extension, date = new Date()) {
  const day = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return `${[type, termTitle(session), day].join(" ").replace(/[\\/:*?"<>|\s]+/g, "_")}.${extension}`;
}
