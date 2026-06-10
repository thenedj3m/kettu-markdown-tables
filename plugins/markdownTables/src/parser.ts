export type Alignment = "left" | "center" | "right";

export type MarkdownTable = {
    header: string[];
    alignments: Alignment[];
    rows: string[][];
};

type ParsedRow = string[];

const PLACEHOLDER = "\uE000";
const INLINE_SEPARATOR = "  │  ";
const STACKED_SEPARATOR = "────────────";
const MAX_INLINE_WIDTH = 58;
const MAX_INLINE_COLUMNS = 3;
const MAX_CELL_WIDTH = 24;

function protectEscapedPipes(input: string) {
    return input.replace(/\\\|/g, PLACEHOLDER);
}

function restoreEscapedPipes(input: string) {
    return input.replace(new RegExp(PLACEHOLDER, "g"), "|").trim();
}

function splitRow(line: string): string[] {
    let value = protectEscapedPipes(line.trim());
    if (value.startsWith("|")) value = value.slice(1);
    if (value.endsWith("|")) value = value.slice(0, -1);
    return value.split("|").map(restoreEscapedPipes);
}

function parseDelimiterCell(cell: string): Alignment | null {
    const value = cell.trim();
    if (!/^:?-{3,}:?$/.test(value)) return null;
    const left = value.startsWith(":");
    const right = value.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
}

function parseDelimiter(line: string, width: number): Alignment[] | null {
    const cells = splitRow(line);
    if (cells.length !== width) return null;
    const alignments = cells.map(parseDelimiterCell);
    if (alignments.some(x => x == null)) return null;
    return alignments as Alignment[];
}

function looksLikeTableHeader(line: string) {
    return line.includes("|") && splitRow(line).length >= 2;
}

function visualLength(input: string) {
    let width = 0;
    for (const char of input) {
        const code = char.codePointAt(0) ?? 0;
        width += code >= 0x1100 && (
            code <= 0x115f ||
            code === 0x2329 || code === 0x232a ||
            (code >= 0x2e80 && code <= 0xa4cf) ||
            (code >= 0xac00 && code <= 0xd7a3) ||
            (code >= 0xf900 && code <= 0xfaff) ||
            (code >= 0xfe10 && code <= 0xfe19) ||
            (code >= 0xfe30 && code <= 0xfe6f) ||
            (code >= 0xff00 && code <= 0xff60) ||
            (code >= 0xffe0 && code <= 0xffe6)
        ) ? 2 : 1;
    }
    return width;
}

function truncate(input: string, width: number) {
    if (visualLength(input) <= width) return input;
    let out = "";
    let used = 0;
    for (const char of input) {
        const w = visualLength(char);
        if (used + w > width - 1) break;
        out += char;
        used += w;
    }
    return out + "…";
}

function pad(input: string, width: number, alignment: Alignment) {
    const diff = Math.max(0, width - visualLength(input));
    if (alignment === "right") return " ".repeat(diff) + input;
    if (alignment === "center") {
        const left = Math.floor(diff / 2);
        return " ".repeat(left) + input + " ".repeat(diff - left);
    }
    return input + " ".repeat(diff);
}

function normalizeRow(row: ParsedRow, width: number) {
    return Array.from({ length: width }, (_, index) => row[index] ?? "");
}

function estimateInlineWidth(widths: number[]) {
    return widths.reduce((sum, width) => sum + width, 0) + INLINE_SEPARATOR.length * Math.max(0, widths.length - 1);
}

function renderInlineTable(header: ParsedRow, alignments: Alignment[], body: ParsedRow[]) {
    const rows = [header, ...body].map(row => normalizeRow(row, header.length));
    const widths = header.map((_, index) => Math.min(
        MAX_CELL_WIDTH,
        Math.max(...rows.map(row => visualLength(row[index] ?? "")))
    ));
    const renderRow = (row: ParsedRow) => header
        .map((_, index) => pad(truncate(row[index] ?? "", widths[index]), widths[index], alignments[index]))
        .join(INLINE_SEPARATOR)
        .trimEnd();

    return [
        renderRow(header),
        STACKED_SEPARATOR,
        ...body.map(renderRow),
    ].join("\n");
}

function renderStackedTable(header: ParsedRow, body: ParsedRow[]) {
    return body.map((row, rowIndex) => {
        const normalized = normalizeRow(row, header.length);
        const lines = header.map((label, index) => {
            const key = label || `Column ${index + 1}`;
            const value = normalized[index] || "—";
            return `${key}: ${value}`;
        });
        return [`#${rowIndex + 1}`, ...lines].join("\n");
    }).join(`\n${STACKED_SEPARATOR}\n`);
}

function renderTable(header: ParsedRow, alignments: Alignment[], body: ParsedRow[]) {
    const rows = [header, ...body].map(row => normalizeRow(row, header.length));
    const fullWidths = header.map((_, index) => Math.max(...rows.map(row => visualLength(row[index] ?? ""))));
    const tooWide = header.length > MAX_INLINE_COLUMNS || estimateInlineWidth(fullWidths) > MAX_INLINE_WIDTH;

    if (tooWide) return renderStackedTable(header, body);
    return renderInlineTable(header, alignments, body);
}

function isFence(line: string) {
    return /^\s*(```|~~~)/.test(line);
}

export function parseMarkdownTables(content: string): MarkdownTable[] {
    if (!content?.includes("|")) return [];

    const lines = content.split("\n");
    const tables: MarkdownTable[] = [];
    let inFence = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isFence(line)) {
            inFence = !inFence;
            continue;
        }

        if (!inFence && looksLikeTableHeader(line) && i + 1 < lines.length) {
            const header = splitRow(line);
            const alignments = parseDelimiter(lines[i + 1], header.length);
            if (alignments) {
                const rows: ParsedRow[] = [];
                let j = i + 2;
                while (j < lines.length && lines[j].includes("|")) {
                    const row = splitRow(lines[j]);
                    if (row.length !== header.length) break;
                    rows.push(normalizeRow(row, header.length));
                    j++;
                }
                if (rows.length) tables.push({
                    header: normalizeRow(header, header.length),
                    alignments,
                    rows,
                });
                i = j - 1;
            }
        }
    }

    return tables;
}

export function renderMarkdownTables(content: string) {
    if (!content?.includes("|")) return content;

    const lines = content.split("\n");
    const out: string[] = [];
    let inFence = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isFence(line)) {
            inFence = !inFence;
            out.push(line);
            continue;
        }

        if (!inFence && looksLikeTableHeader(line) && i + 1 < lines.length) {
            const header = splitRow(line);
            const alignments = parseDelimiter(lines[i + 1], header.length);
            if (alignments) {
                const body: ParsedRow[] = [];
                let j = i + 2;
                while (j < lines.length && lines[j].includes("|")) {
                    const row = splitRow(lines[j]);
                    if (row.length !== header.length) break;
                    body.push(row);
                    j++;
                }
                out.push("```", renderTable(header, alignments, body), "```");
                i = j - 1;
                continue;
            }
        }

        out.push(line);
    }

    return out.join("\n");
}
