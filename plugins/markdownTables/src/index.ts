import { findByName } from "@vendetta/metro";
import { FluxDispatcher, React, ReactNative } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

import { parseMarkdownTables, renderMarkdownTables, type MarkdownTable } from "./parser";

const MARKER = "__markdownTablesOriginalContent";
const RN_MARKER = "__markdownTablesRNInjected";
let patches: (() => void)[] = [];

const { View, Text, ScrollView } = ReactNative;

function patchMessage(message: any) {
    if (!message || typeof message.content !== "string") return;
    if ((message as any)[MARKER]) return;

    const rendered = renderMarkdownTables(message.content);
    if (rendered === message.content) return;

    try {
        Object.defineProperty(message, MARKER, {
            value: message.content,
            enumerable: false,
            configurable: true,
        });
    } catch {}
    message.content = rendered;
}

function getOriginalContent(message: any) {
    if (!message) return "";
    return (message as any)[MARKER] ?? message.content ?? "";
}

function patchEvent(event: any) {
    if (!event) return;

    patchMessage(event.message);

    const messages = event.messages;
    if (Array.isArray(messages)) {
        for (const message of messages) patchMessage(message);
    } else if (messages && typeof messages === "object") {
        for (const message of Object.values(messages)) patchMessage(message);
    }
}

function cellTextStyle(alignment: string, header = false) {
    return {
        color: header ? "#f2f3f5" : "#dbdee1",
        fontSize: 13,
        lineHeight: 18,
        fontWeight: header ? "700" : "400",
        textAlign: alignment,
    } as any;
}

function TableView({ table }: { table: MarkdownTable }) {
    const columnWidths = table.header.map((_, index) => {
        const maxChars = Math.max(
            table.header[index]?.length ?? 0,
            ...table.rows.map(row => row[index]?.length ?? 0),
        );
        return Math.min(220, Math.max(92, maxChars * 8 + 28));
    });

    const renderCell = (value: string, columnIndex: number, header = false) => React.createElement(View, {
        key: `${header ? "h" : "b"}-${columnIndex}`,
        style: {
            width: columnWidths[columnIndex],
            paddingVertical: 7,
            paddingHorizontal: 8,
            borderRightWidth: columnIndex === table.header.length - 1 ? 0 : 1,
            borderRightColor: "rgba(255,255,255,0.08)",
        },
    }, React.createElement(Text, {
        numberOfLines: 2,
        ellipsizeMode: "tail",
        selectable: true,
        style: cellTextStyle(table.alignments[columnIndex] ?? "left", header),
    }, value || "—"));

    return React.createElement(ScrollView, {
        horizontal: true,
        showsHorizontalScrollIndicator: true,
        style: { marginTop: 4, marginBottom: 6, maxWidth: "100%" },
        contentContainerStyle: { paddingRight: 8 },
    }, React.createElement(View, {
        style: {
            borderRadius: 6,
            overflow: "hidden",
            backgroundColor: "rgba(0,0,0,0.18)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
        },
    }, [
        React.createElement(View, {
            key: "header",
            style: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.08)" },
        }, table.header.map((cell, index) => renderCell(cell, index, true))),
        ...table.rows.map((row, rowIndex) => React.createElement(View, {
            key: `row-${rowIndex}`,
            style: {
                flexDirection: "row",
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.06)",
                backgroundColor: rowIndex % 2 ? "rgba(255,255,255,0.025)" : "transparent",
            },
        }, table.header.map((_, columnIndex) => renderCell(row[columnIndex] ?? "", columnIndex)))),
    ]));
}

function TablesView({ tables }: { tables: MarkdownTable[] }) {
    return React.createElement(View, { style: { marginTop: 2 } }, tables.map((table, index) => React.createElement(TableView, {
        key: `table-${index}`,
        table,
    })));
}

function appendTablesToRenderResult(result: any, message: any) {
    const content = getOriginalContent(message);
    const tables = parseMarkdownTables(content);
    if (!tables.length) return result;

    if (result?.props?.[RN_MARKER]) return result;

    const tableNode = React.createElement(TablesView, { tables });
    const wrapped = React.createElement(View, {
        [RN_MARKER]: true,
        style: { width: "100%" },
    } as any, [result, tableNode]);
    return wrapped;
}

function patchMessageContentRenderer() {
    const createMessageContent = findByName("createMessageContent", false);
    if (!createMessageContent?.default) return false;

    patches.push(after("default", createMessageContent, (args: any[], result: any) => {
        const content = args[0];
        const message = content?.message;
        if (!message) return;
        return appendTablesToRenderResult(result, message);
    }));
    return true;
}

export default {
    onLoad() {
        patches.push(before("dispatch", FluxDispatcher, (args: any[]) => patchEvent(args[0])));
        const rnPatchOk = patchMessageContentRenderer();
        showToast(rnPatchOk ? "Markdown Tables RN PoC enabled" : "Markdown Tables fallback enabled", getAssetIDByName("ic_text_24px"));
    },

    onUnload() {
        patches.forEach(unpatch => unpatch());
        patches = [];
    }
};
