export type Alignment = "left" | "center" | "right";

type ParsedRow = string[];

const PLACEHOLDER = "\uE000";

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
    return [...input].length;
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

function border(left: string, mid: string, right: string, widths: number[]) {
    return left + widths.map(width => "─".repeat(width + 2)).join(mid) + right;
}

function renderTable(header: ParsedRow, alignments: Alignment[], body: ParsedRow[]) {
    const rows = [header, ...body].map(row => row.slice(0, header.length));
    const widths = header.map((_, index) => Math.max(...rows.map(row => visualLength(row[index] ?? ""))));
    const renderRow = (row: ParsedRow) => "│" + header.map((_, index) => ` ${pad(row[index] ?? "", widths[index], alignments[index])} `).join("│") + "│";

    return [
        border("┌", "┬", "┐", widths),
        renderRow(header),
        border("├", "┼", "┤", widths),
        ...body.map(renderRow),
        border("└", "┴", "┘", widths),
    ].join("\n");
}

function isFence(line: string) {
    return /^\s*(```|~~~)/.test(line);
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
