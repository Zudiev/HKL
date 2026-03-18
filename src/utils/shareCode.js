import { CATEGORIES as CATEGORIES_DEFAULT } from "../questions/questions.js";

// ─── ENCODE / DECODE SHARE CODE ──────────────────────────────────────────────
const ALL_IDS = CATEGORIES_DEFAULT.flatMap((c) => c.questions.map((q) => q.id))
    .sort((a, b) => a - b);
const CURRENT_ID_SET = new Set(ALL_IDS);

// full sequential range covering every ID that has ever existed (1-169)
// this keeps old codes compatible even when questions are removed
const MAX_EVER_ID = 169;
const FULL_IDS = Array.from({ length: MAX_EVER_ID }, (_, i) => i + 1);

// pair encoding for switch mode: one char encodes both sub + tist answer
const PAIR_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVW"; // 49 chars for 7×7
const PAIR_VAL_IDX = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }; // unanswered → 6
const PAIR_IDX_VAL = [0, 1, 2, 3, 4, 5, null]; // null = unanswered

export function encodeAnswers(answers, tistOverrides = null) {
    if (tistOverrides) {
        // v3s pair encoding: one char per question encodes both sub + tist
        const pairCompact = FULL_IDS.map((id) => {
            const subVal = answers[id];
            const tistVal = tistOverrides[id] !== undefined ? tistOverrides[id] : subVal;
            const si = subVal !== undefined ? PAIR_VAL_IDX[subVal] : 6;
            const ti = tistVal !== undefined ? PAIR_VAL_IDX[tistVal] : 6;
            return PAIR_CHARS[si * 7 + ti];
        }).join("");
        return "v3s:" + btoa(pairCompact);
    }

    const compact = FULL_IDS.map((id) => {
        const val = answers[id];
        return val !== undefined ? String(val) : "-";
    }).join("");
    return "v2:" + btoa(compact);
}

export function decodeAnswers(code) {
    const trimmed = code.trim().replace(/-(SUBJ|TIST|SWIT)$/i, "");

    // v3s pair encoding: one char per question encodes both sub + tist
    if (trimmed.startsWith("v3s:")) {
        try {
            const pairCompact = atob(trimmed.slice(4));
            const subResult = {};
            const tistResult = {};
            for (let i = 0; i < pairCompact.length; i++) {
                const ch = pairCompact[i];
                const id = i + 1;
                if (!CURRENT_ID_SET.has(id)) continue;
                const idx = PAIR_CHARS.indexOf(ch);
                if (idx === -1) continue;
                const si = Math.floor(idx / 7);
                const ti = idx % 7;
                const subVal = PAIR_IDX_VAL[si];
                const tistVal = PAIR_IDX_VAL[ti];
                if (subVal !== null) subResult[id] = subVal;
                if (tistVal !== null && tistVal !== subVal) tistResult[id] = tistVal;
            }
            return { answers: subResult, tistAnswers: tistResult };
        } catch {
            return null;
        }
    }

    // legacy switch format: v2s:<base64(sub|tist)>
    if (trimmed.startsWith("v2s:")) {
        try {
            const decoded = atob(trimmed.slice(4));
            const pipeIdx = decoded.indexOf("|");
            if (pipeIdx === -1) return null;
            const subCompact  = decoded.slice(0, pipeIdx);
            const tistCompact = decoded.slice(pipeIdx + 1);

            const subResult = {};
            for (let i = 0; i < subCompact.length; i++) {
                const ch = subCompact[i];
                const id = i + 1;
                if (ch !== "-" && CURRENT_ID_SET.has(id)) {
                    const num = parseInt(ch, 10);
                    if (!isNaN(num)) subResult[id] = num;
                }
            }

            const tistResult = {};
            for (let i = 0; i < tistCompact.length; i++) {
                const ch = tistCompact[i];
                const id = i + 1;
                if (ch !== "-" && CURRENT_ID_SET.has(id)) {
                    const num = parseInt(ch, 10);
                    if (!isNaN(num)) tistResult[id] = num;
                }
            }

            return { answers: subResult, tistAnswers: tistResult };
        } catch {
            return null;
        }
    }

    if (trimmed.startsWith("v2:")) {
        try {
            const compact = atob(trimmed.slice(3));
            const result  = {};
            // always map position i to ID i+1 (sequential), then only keep current IDs
            for (let i = 0; i < compact.length; i++) {
                const ch = compact[i];
                const id = i + 1;
                if (ch !== "-" && CURRENT_ID_SET.has(id)) {
                    const num = parseInt(ch, 10);
                    if (!isNaN(num)) result[id] = num;
                }
            }
            return result;
        } catch {
            return null;
        }
    }
    try {
        const binary  = atob(trimmed);
        const bytes   = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const payload = new TextDecoder().decode(bytes);
        const parsed  = JSON.parse(payload);
        if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
        const result = {};
        for (const [k, v] of Object.entries(parsed)) {
            const id = Number(k);
            if (CURRENT_ID_SET.has(id)) result[id] = v;
        }
        return result;
    } catch {
        return null;
    }
}
