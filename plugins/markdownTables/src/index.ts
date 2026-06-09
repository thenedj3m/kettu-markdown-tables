import { FluxDispatcher } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

import { renderMarkdownTables } from "./parser";

const MARKER = "__markdownTablesOriginalContent";
let patches: (() => void)[] = [];

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

export default {
    onLoad() {
        patches.push(before("dispatch", FluxDispatcher, ([event]) => patchEvent(event)));
        showToast("Markdown Tables enabled", getAssetIDByName("ic_text_24px"));
    },

    onUnload() {
        patches.forEach(unpatch => unpatch());
        patches = [];
    }
};
