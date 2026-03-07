/**
 * columns.js — shared helpers for column name display and query normalization
 *
 * UI always shows humanized names (e.g. "Bonus %", "Hire Date").
 * Backend always receives original snake_case names (e.g. "bonus_pct", "hire_date").
 */

/* ── Special-case overrides ── */
const SPECIAL = {
    employee_id: "Employee ID",
    bonus_pct: "Bonus %",
    id: "ID",
    url: "URL",
    ip: "IP",
};

/**
 * Convert a snake_case column name to a human-readable label.
 * @param {string} name  raw column name (e.g. "office_location")
 * @returns {string}     human label  (e.g. "Office Location")
 */
export function humanizeColumnName(name) {
    if (!name) return name;
    if (SPECIAL[name]) return SPECIAL[name];
    return name
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build a case-insensitive mapping from humanized (and space-separated)
 * column names back to the original snake_case names.
 *
 * @param {string[]} columns  list of raw column names
 * @returns {Object}          e.g. { "office location": "office_location", "bonus %": "bonus_pct" }
 */
export function buildColumnMapping(columns) {
    const mapping = {};
    for (const col of columns) {
        // "office_location" → "office location"
        const spaced = col.replace(/_/g, " ").toLowerCase();
        if (spaced !== col.toLowerCase()) mapping[spaced] = col;

        // humanized label → raw name (catches SPECIAL overrides like "Bonus %" → "bonus_pct")
        const humanized = humanizeColumnName(col).toLowerCase();
        if (humanized !== col.toLowerCase()) mapping[humanized] = col;
    }
    return mapping;
}

/**
 * Replace human-readable column references in a query string with
 * the original snake_case column names before sending to the backend.
 *
 * @param {string}   query    user's raw input (e.g. "Average performance score by department")
 * @param {string[]} columns  list of real column names from the schema
 * @returns {string}          normalized query (e.g. "Average performance_score by department")
 */
export function normalizeQuery(query, columns) {
    if (!columns || columns.length === 0) return query;
    const mapping = buildColumnMapping(columns);

    // Replace longest phrases first to avoid partial substitutions
    let normalized = query;
    const phrases = Object.keys(mapping).sort((a, b) => b.length - a.length);
    for (const phrase of phrases) {
        // Word-boundary aware, case-insensitive
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(?<![\\w_])${escaped}(?![\\w_])`, "gi");
        normalized = normalized.replace(regex, mapping[phrase]);
    }
    return normalized;
}
