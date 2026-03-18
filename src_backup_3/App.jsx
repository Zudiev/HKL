import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import "./quiz.css";
import { CATEGORIES as CATEGORIES_DEFAULT, SCALE } from "./questions/questions.js";
import { CATEGORIES as CATEGORIES_SUB } from "./questions/questionsSub.js";
import { CATEGORIES as CATEGORIES_TIST } from "./questions/questionsTist.js";

// ─── 67 EASTER EGG ASSETS ───────────────────────────────────────────────────
import vineBoom from "./assets/sounds/vine-boom.mp3";
import img1 from "./assets/Shush.jpg";
import img2 from "./assets/FUCK.png";
import img3 from "./assets/3E999D72-B7F7-4B68-A696-64161760C5F3.gif";
import img4 from "./assets/G8lXTj7WQAAGD1H.png";
import vid1 from "./assets/WKno0Ci.mp4";

const EGG_IMAGES = [
    { type: "image", src: img1 },
    { type: "image", src: img2 },
    { type: "image", src: img3 },
    { type: "image", src: img4 },
];
const EGG_VIDEO = { type: "video", src: vid1 };

function pickEggMedia() {
    // 80% chance image, 20% chance video
    if (Math.random() < 0.8 || EGG_IMAGES.length === 0) {
        return EGG_IMAGES[Math.floor(Math.random() * EGG_IMAGES.length)];
    }
    return EGG_VIDEO;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const MAX_VAL = Math.max(...SCALE.map((s) => s.value));
const labelOf = (val) => SCALE.find((s) => s.value === val)?.label ?? "-";
const pctOf   = (val) => Math.round((val / MAX_VAL) * 100);

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

function encodeAnswers(answers, tistOverrides = null) {
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

function decodeAnswers(code) {
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

// ─── TEXT-BASED PDF ───────────────────────────────────────────────────────────

async function exportAsPDF(answers, filename = "quiz-results.pdf", role = null, categories = CATEGORIES_DEFAULT, tistAnswers = null) {
    const { jsPDF } = await import("jspdf");

    // build tist question text lookup for switch mode
    const tistQText = {};
    if (tistAnswers) {
        CATEGORIES_TIST.flatMap((c) => c.questions).forEach((q) => {
            tistQText[q.id] = q.text;
        });
    }

    const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const PW     = 210;
    const margin = 16;
    const usable = PW - margin * 2;
    let   y      = margin;

    const addText = (text, size, bold = false, r = 20, g = 20, b = 20) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(r, g, b);
        const lines = doc.splitTextToSize(text, usable);
        lines.forEach((line) => {
            if (y > 280) { doc.addPage(); y = margin; }
            doc.text(line, margin, y);
            y += size * 0.45;
        });
    };

    const addBar = (pct, tist = false) => {
        const barW  = 40;
        const barH  = tist ? 2 : 2.5;
        const barX  = PW - margin - barW;
        if (y > 280) { doc.addPage(); y = margin; }
        doc.setFillColor(220, 220, 220);
        doc.roundedRect(barX, y - 2.5, barW, barH, 1, 1, "F");
        if (pct > 0) {
            if (tist) {
                doc.setFillColor(150, 130, 200);
            } else {
                doc.setFillColor(201, 169, 110);
            }
            doc.roundedRect(barX, y - 2.5, barW * (pct / 100), barH, 1, 1, "F");
        }
    };

    const labelColX = PW - margin - 40 - 30;

    addText("Quiz Results", 22, true, 15, 15, 15);
    y += 2;
    if (role) {
        addText(`Role: ${role.charAt(0).toUpperCase() + role.slice(1)}`, 10, false, 150, 110, 50);
        y += 2;
    }
    addText(`${Object.keys(answers).length} questions answered across ${categories.length} categories`, 9, false, 120, 120, 120);
    y += 8;

    for (const cat of categories) {
        if (y > 265) { doc.addPage(); y = margin; }
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, PW - margin, y);
        y += 5;
        addText(cat.title.toUpperCase(), 9, true, 100, 100, 180);
        y += 3;

        for (let qi = 0; qi < cat.questions.length; qi++) {
            const q = cat.questions[qi];
            if (y > 278) { doc.addPage(); y = margin; }
            const val   = answers[q.id] !== undefined ? answers[q.id] : null;
            const label = val !== null ? labelOf(val) : "Skipped";
            const pct   = val !== null ? pctOf(val) : 0;

            const rowH = 5.2;
            if (qi % 2 === 1) {
                doc.setFillColor(245, 245, 245);
                doc.rect(margin - 2, y - 3.5, usable + 4, rowH, "F");
            }

            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(40, 40, 40);
            const lines = doc.splitTextToSize(q.text, labelColX - margin - 4);
            doc.text(lines, margin, y);

            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            if (val !== null) {
                doc.setTextColor(150, 110, 50);
            } else {
                doc.setTextColor(160, 160, 160);
            }
            doc.text(label, labelColX + 24, y, { align: "right" });

            addBar(pct);
            y += lines.length * 4.2 + 1;

            // switch mode: show tist answer if it differs
            if (tistAnswers && val !== null) {
                const tistVal = tistAnswers[q.id] !== undefined ? tistAnswers[q.id] : val;
                if (tistVal !== val) {
                    if (y > 280) { doc.addPage(); y = margin; }
                    const tistLabel = labelOf(tistVal);
                    const tistPct   = pctOf(tistVal);
                    const tistText  = tistQText[q.id] || q.text;

                    doc.setFontSize(7);
                    doc.setFont("helvetica", "italic");
                    doc.setTextColor(130, 115, 170);
                    const tLines = doc.splitTextToSize(`\u21C4 ${tistText}`, labelColX - margin - 12);
                    doc.text(tLines[0] || tistText, margin + 8, y);

                    doc.setFontSize(7);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(130, 115, 170);
                    doc.text(tistLabel, labelColX + 24, y, { align: "right" });

                    addBar(tistPct, true);
                    y += 4;
                }
            }
        }
        y += 3;
    }

    // embed share code at the bottom of the PDF
    y += 6;
    if (y > 265) { doc.addPage(); y = margin; }
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, PW - margin, y);
    y += 5;
    addText("SHARE CODE", 8, true, 100, 100, 180);
    y += 2;
    addText("Use this code to import and edit these results on the site:", 7, false, 140, 140, 140);
    y += 2;
    const code = encodeAnswers(answers, tistAnswers);
    doc.setFontSize(6);
    doc.setFont("courier", "normal");
    doc.setTextColor(80, 80, 80);
    const codeLines = doc.splitTextToSize(code, usable);
    codeLines.forEach((line) => {
        if (y > 285) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += 3;
    });

    doc.save(filename);
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function PreferenceQuiz() {
    const [role,         setRole]          = useState(null);   // "hypnotist" | "subject" | "switch"
    const [catIndex,      setCatIndex]      = useState(0);
    const [answers,       setAnswers]       = useState({});
    const [tistAnswers,   setTistAnswers]   = useState({});    // switch mode: explicit tist overrides
    const [submitted,     setSubmitted]     = useState(false);
    const [exporting,     setExporting]     = useState(false);
    const [activeTooltip, setActiveTooltip] = useState(null);

    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importInput,     setImportInput]     = useState("");
    const [importError,     setImportError]     = useState("");
    const [copied,          setCopied]          = useState(false);

    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfName,      setPdfName]      = useState("");
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveName,      setSaveName]      = useState("");

    // compare states
    const [showCompareModal,   setShowCompareModal]   = useState(false);
    const [compareStep,        setCompareStep]        = useState(1);
    const [compareMyInput,     setCompareMyInput]     = useState("");
    const [compareTheirInput,  setCompareTheirInput]  = useState("");
    const [compareError,       setCompareError]       = useState("");
    const [compareView,        setCompareView]        = useState(false);
    const [compareMyAnswers,   setCompareMyAnswers]   = useState(null);
    const [compareTheirAnswers,setCompareTheirAnswers]= useState(null);
    const [openSections,       setOpenSections]       = useState({ 0: true, 1: false, 2: false, 3: false });
    const [helpVisible,        setHelpVisible]        = useState({});
    const [compareMySwitchData,    setCompareMySwitchData]    = useState(null);
    const [compareTheirSwitchData, setCompareTheirSwitchData] = useState(null);

    // switch mode: which tist dropdowns are open
    const [openTistDropdowns, setOpenTistDropdowns] = useState(new Set());

    // saved results (localStorage)
    const [savedResults, setSavedResults] = useState([]);
    const [showSavedModal, setShowSavedModal] = useState(false);

    // results view: collapsible sub/tist sections for switch
    const [resultSubOpen, setResultSubOpen]   = useState(false);
    const [resultTistOpen, setResultTistOpen] = useState(false);

    const bottomRef = useRef(null);

    // ── ROLE-SPECIFIC CATEGORIES ────────────────────────────────────────────
    const displayCategories = useMemo(() => {
        if (role === "hypnotist") return CATEGORIES_TIST;
        if (role === "subject" || role === "switch") return CATEGORIES_SUB;
        return CATEGORIES_DEFAULT;
    }, [role]);

    // ── LOCAL STORAGE: load saved results on mount ─────────────────────────
    useEffect(() => {
        try {
            const raw = localStorage.getItem("quizSavedResults");
            if (raw) setSavedResults(JSON.parse(raw));
        } catch { /* ignore corrupt data */ }
    }, []);

    const persistSaved = (list) => {
        setSavedResults(list);
        try { localStorage.setItem("quizSavedResults", JSON.stringify(list)); } catch {}
    };

    const saveCurrentResults = (label) => {
        const entry = {
            id: Date.now(),
            label: label || new Date().toLocaleDateString(),
            role,
            code: role === "switch" ? encodeAnswers(answers, tistAnswers) : encodeAnswers(answers),
            date: new Date().toISOString(),
        };
        persistSaved([entry, ...savedResults]);
    };

    const deleteSavedResult = (id) => {
        persistSaved(savedResults.filter((r) => r.id !== id));
    };

    const loadSavedResult = (entry) => {
        const decoded = decodeAnswers(entry.code);
        if (!decoded) return;
        if (decoded.answers && decoded.tistAnswers) {
            setAnswers(decoded.answers);
            setTistAnswers(decoded.tistAnswers);
            setRole(entry.role || "switch");
        } else {
            setAnswers(decoded.answers || decoded);
            setRole(entry.role || "subject");
        }
        setSubmitted(true);
        setShowSavedModal(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // lookup: question ID → tist question object (for switch dropdown)
    const tistQMap = useMemo(() => {
        const map = {};
        CATEGORIES_TIST.flatMap((c) => c.questions).forEach((q) => { map[q.id] = q; });
        return map;
    }, []);

    // ── 67 EASTER EGG ────────────────────────────────────────────────────────
    const [eggMedia, setEggMedia]   = useState(null);   // { type, src }
    const [eggFading, setEggFading] = useState(false);
    const keyBuf = useRef("");
    const keyTimer = useRef(null);

    const trigger67 = useCallback(() => {
        const pick = pickEggMedia();
        setEggMedia(pick);
        setEggFading(false);

        if (pick.type !== "video") {
            new Audio(vineBoom).play().catch(() => {});
            setTimeout(() => setEggFading(true), 2500);
            setTimeout(() => setEggMedia(null), 3200);
        }
    }, []);

    const handleVideoEnd = useCallback(() => {
        setEggFading(true);
        setTimeout(() => setEggMedia(null), 700);
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            keyBuf.current += e.key;
            clearTimeout(keyTimer.current);
            keyTimer.current = setTimeout(() => { keyBuf.current = ""; }, 800);
            if (keyBuf.current.includes("67")) {
                keyBuf.current = "";
                trigger67();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [trigger67]);

    // wraps text so every occurrence of "67" becomes a clickable span
    const wrap67 = (text) => {
        if (typeof text !== "string" || !text.includes("67")) return text;
        const parts = text.split(/(67)/g);
        return parts.map((p, i) =>
            p === "67" ? (
                <span key={i} className="clickable-67" onClick={trigger67}>67</span>
            ) : p
        );
    };

    const currentCategory    = displayCategories[catIndex];
    const isLastCategory     = catIndex === displayCategories.length - 1;
    const isFirstCategory    = catIndex === 0;

    const answeredInCurrent = useMemo(
        () => currentCategory.questions.filter((q) => q.id in answers).length,
        [answers, currentCategory]
    );

    const pick = (qid, val) =>
        setAnswers((prev) => ({ ...prev, [qid]: val }));

    const pickTist = (qid, val) =>
        setTistAnswers((prev) => ({ ...prev, [qid]: val }));

    const toggleTistDropdown = (qid) =>
        setOpenTistDropdowns((prev) => {
            const next = new Set(prev);
            if (next.has(qid)) next.delete(qid);
            else next.add(qid);
            return next;
        });

    const goToCategory = (index) => {
        setCatIndex(index);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleNext = () => {
        if (isLastCategory) {
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            goToCategory(catIndex + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstCategory) goToCategory(catIndex - 1);
    };

    const handleScrollToBottom = () =>
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });

    const handleScrollToTop = () =>
        window.scrollTo({ top: 0, behavior: "smooth" });

    const handleRetake = () => {
        setAnswers({});
        setTistAnswers({});
        setOpenTistDropdowns(new Set());
        setCatIndex(0);
        setSubmitted(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleEditAnswers = () => {
        setCatIndex(0);
        setSubmitted(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const ROLE_TAG = { hypnotist: "TIST", subject: "SUBJ", switch: "SWIT" };
    const roleTag  = role ? ROLE_TAG[role] : "";

    const shareCode = (role === "switch"
        ? encodeAnswers(answers, tistAnswers)
        : encodeAnswers(answers))
        + (roleTag ? `-${roleTag}` : "");

    const handleCopy = () => {
        navigator.clipboard.writeText(shareCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleImport = (editMode = false) => {
        const decoded = decodeAnswers(importInput);
        if (!decoded) {
            setImportError("Invalid code -please check and try again.");
            return;
        }
        // switch format returns { answers, tistAnswers }
        if (decoded.answers && decoded.tistAnswers) {
            setAnswers(decoded.answers);
            setTistAnswers(decoded.tistAnswers);
            if (!role) setRole("switch");
        } else {
            setAnswers(decoded);
        }
        if (editMode) {
            setCatIndex(0);
            setSubmitted(false);
        } else {
            setSubmitted(true);
        }
        setShowImportModal(false);
        setImportInput("");
        setImportError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleExportPDF = () => {
        setPdfName("");
        setShowPdfModal(true);
    };

    const handleConfirmPDF = async () => {
        setShowPdfModal(false);
        setExporting(true);
        const slug = pdfName.trim().replace(/\s+/g, "-");
        try {
            if (role === "switch") {
                const subParts  = [slug, "subject"].filter(Boolean).join("-");
                const tistParts = [slug, "hypnotist"].filter(Boolean).join("-");
                const subFile   = subParts  ? `quiz-result-${subParts}.pdf`  : "quiz-result-subject.pdf";
                const tistFile  = tistParts ? `quiz-result-${tistParts}.pdf` : "quiz-result-hypnotist.pdf";

                // Build merged tist answers (inherit from sub where not explicitly set)
                const mergedTist = {};
                CATEGORIES_TIST.flatMap((c) => c.questions).forEach((q) => {
                    mergedTist[q.id] = tistAnswers[q.id] !== undefined ? tistAnswers[q.id] : answers[q.id];
                });

                await exportAsPDF(answers, subFile, "subject", CATEGORIES_SUB);
                await exportAsPDF(mergedTist, tistFile, "hypnotist", CATEGORIES_TIST);
            } else {
                const parts    = [slug, roleTag].filter(Boolean).join("-");
                const filename = parts ? `quiz-result-${parts}.pdf` : "quiz-result.pdf";
                await exportAsPDF(answers, filename, role, displayCategories);
            }
        }
        finally { setExporting(false); }
    };

    // ── COMPARE HANDLERS ────────────────────────────────────────────────────
    const handleOpenCompare = () => {
        setCompareStep(1);
        setCompareMyInput("");
        setCompareTheirInput("");
        setCompareError("");
        setCompareMySwitchData(null);
        setCompareTheirSwitchData(null);
        setShowCompareModal(true);
    };

    const extractSwitchRole = (switchData, pickRole) => {
        if (pickRole === "sub") return switchData.answers;
        return { ...switchData.answers, ...switchData.tistAnswers };
    };

    const handleCompareNext = () => {
        const decoded = decodeAnswers(compareMyInput);
        if (!decoded) {
            setCompareError("Invalid code - please check and try again.");
            return;
        }
        setCompareError("");
        if (decoded.answers && decoded.tistAnswers) {
            setCompareMySwitchData(decoded);
            setCompareStep(2); // role pick
        } else {
            setCompareMyAnswers(decoded.answers || decoded);
            setCompareStep(3); // skip to their code
        }
    };

    const handleCompareMyRole = (pickRole) => {
        setCompareMyAnswers(extractSwitchRole(compareMySwitchData, pickRole));
        setCompareStep(3);
    };

    const finishCompare = () => {
        setShowCompareModal(false);
        setCompareError("");
        setOpenSections({ 0: true, 1: false, 2: false, 3: false });
        setHelpVisible({});
        setCompareView(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleCompareFinish = () => {
        const decoded = decodeAnswers(compareTheirInput);
        if (!decoded) {
            setCompareError("Invalid code - please check and try again.");
            return;
        }
        setCompareError("");
        if (decoded.answers && decoded.tistAnswers) {
            setCompareTheirSwitchData(decoded);
            setCompareStep(4); // role pick
        } else {
            setCompareTheirAnswers(decoded.answers || decoded);
            finishCompare();
        }
    };

    const handleCompareTheirRole = (pickRole) => {
        setCompareTheirAnswers(extractSwitchRole(compareTheirSwitchData, pickRole));
        finishCompare();
    };

    const handleCloseCompare = () => {
        setCompareView(false);
        setCompareMyAnswers(null);
        setCompareTheirAnswers(null);
    };

    const toggleSection = (i) =>
        setOpenSections((prev) => ({ ...prev, [i]: !prev[i] }));

    const toggleHelp = (i) =>
        setHelpVisible((prev) => ({ ...prev, [i]: !prev[i] }));

    const compareData = useMemo(() => {
        if (!compareMyAnswers || !compareTheirAnswers) return null;
        const allQs = displayCategories.flatMap((c) => c.questions);

        const bothLove = allQs.filter(
            (q) => compareMyAnswers[q.id] === 5 && compareTheirAnswers[q.id] === 5
        );
        const sharedInterest = allQs.filter((q) => {
            const my = compareMyAnswers[q.id];
            const their = compareTheirAnswers[q.id];
            return my >= 2 && my <= 4 && their >= 2 && their <= 4;
        });
        const theirCurious = allQs.filter((q) => compareTheirAnswers[q.id] === 1);
        const theirNo = allQs.filter((q) => compareTheirAnswers[q.id] === 0);

        return { bothLove, sharedInterest, theirCurious, theirNo };
    }, [compareMyAnswers, compareTheirAnswers, displayCategories]);

    const SECTIONS = [
        { title: "Both Love",               help: "Questions that both you and the other person answered as \"Love\" -your strongest shared interests." },
        { title: "Shared Interests",         help: "Questions where both of you answered Maybe, Okay, or Like (values 2-4) -things you're both moderately into." },
        { title: "They're Curious About",    help: "Questions the other person marked as \"Curious about\" -things they'd like to explore." },
        { title: "They Said No",             help: "Questions the other person answered \"No\" -their hard limits or disinterests." },
    ];

    const sectionItems = compareData
        ? [compareData.bothLove, compareData.sharedInterest, compareData.theirCurious, compareData.theirNo]
        : [[], [], [], []];

    const EggOverlay = () => eggMedia && (
        <div className={`egg-overlay${eggFading ? " fading" : ""}`}>
            {eggMedia.type === "video" ? (
                <video className="egg-media" src={eggMedia.src} autoPlay onEnded={handleVideoEnd} />
            ) : (
                <img className="egg-media" src={eggMedia.src} alt="" />
            )}
        </div>
    );

    const Topbar = () => (
        <div className="topbar">
            <button className="import-btn" onClick={() => setShowImportModal(true)}>
                ↑ Import results
            </button>
            <button className="compare-btn" onClick={handleOpenCompare}>
                ⇄ Compare
            </button>
            <a
                className="socials-btn"
                href="https://guns.lol/meltingg"
                target="_blank"
                rel="noreferrer"
            >
                ✦ Socials
            </a>
            <a
                className="kofi-btn"
                href="https://ko-fi.com/lycheejuice"
                target="_blank"
                rel="noreferrer"
            >
                ☕ Support me on Ko-fi
            </a>
        </div>
    );

    // ── COMPARE MODAL (shared across all views) ─────────────────────────────
    const SwitchRolePicker = ({ label, onPick }) => (
        <>
            <h3 className="modal-title">{label}</h3>
            <p className="modal-sub">This is a hypnoswitch code. Which role's answers should be used?</p>
            <div className="modal-actions">
                <button className="action-btn primary" onClick={() => onPick("sub")}>Subject</button>
                <button className="action-btn primary" onClick={() => onPick("tist")}>Hypnotist</button>
                <button className="action-btn" onClick={() => setShowCompareModal(false)}>Cancel</button>
            </div>
        </>
    );

    const CompareModal = () => showCompareModal && (
        <div className="modal-overlay" onClick={() => setShowCompareModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                {compareStep === 1 && (
                    <>
                        <h3 className="modal-title">Step 1: Your results</h3>
                        <p className="modal-sub">Paste your own share code below.</p>
                        <textarea
                            className="code-box"
                            value={compareMyInput}
                            onChange={(e) => { setCompareMyInput(e.target.value); setCompareError(""); }}
                            placeholder="Paste your code here…"
                        />
                        {compareError && <p className="import-error">{compareError}</p>}
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={handleCompareNext}>Next →</button>
                            <button className="action-btn" onClick={() => setShowCompareModal(false)}>Cancel</button>
                        </div>
                    </>
                )}
                {compareStep === 2 && (
                    <SwitchRolePicker label="Your role" onPick={handleCompareMyRole} />
                )}
                {compareStep === 3 && (
                    <>
                        <h3 className="modal-title">Step 2: Their results</h3>
                        <p className="modal-sub">Now paste the other person's share code.</p>
                        <textarea
                            className="code-box"
                            value={compareTheirInput}
                            onChange={(e) => { setCompareTheirInput(e.target.value); setCompareError(""); }}
                            placeholder="Paste their code here…"
                        />
                        {compareError && <p className="import-error">{compareError}</p>}
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={handleCompareFinish}>Compare</button>
                            <button className="action-btn" onClick={() => { setCompareStep(1); setCompareError(""); }}>← Back</button>
                            <button className="action-btn" onClick={() => setShowCompareModal(false)}>Cancel</button>
                        </div>
                    </>
                )}
                {compareStep === 4 && (
                    <SwitchRolePicker label="Their role" onPick={handleCompareTheirRole} />
                )}
            </div>
        </div>
    );

    // ── COMPARE VIEW ──────────────────────────────────────────────────────────
    if (compareView && compareData) {
        return (
            <div className="quiz-wrapper">
                <Topbar />
                <div className="results">
                    <div className="results-header">
                        <p className="results-eyebrow">Comparison</p>
                        <h2 className="results-title">Your Compatibility</h2>
                        <p className="results-sub">See what you have in common</p>
                    </div>

                    {SECTIONS.map((sec, i) => (
                        <div key={i} className="compare-section">
                            <div className="compare-section-header" onClick={() => toggleSection(i)}>
                                <span className={`compare-arrow${openSections[i] ? " open" : ""}`}>›</span>
                                <span className="compare-section-title">{sec.title}</span>
                                <span className="compare-count">{sectionItems[i].length}</span>
                                <button
                                    className="compare-help-btn"
                                    onClick={(e) => { e.stopPropagation(); toggleHelp(i); }}
                                >?</button>
                            </div>
                            {helpVisible[i] && (
                                <p className="compare-help-text">{sec.help}</p>
                            )}
                            {openSections[i] && (
                                <div className="compare-section-body">
                                    {sectionItems[i].length === 0 ? (
                                        <p className="compare-empty">No matching questions.</p>
                                    ) : (
                                        sectionItems[i].map((q) => (
                                            <p key={q.id} className="compare-item">{wrap67(q.text)}</p>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    <div className="results-actions">
                        <button className="action-btn" onClick={handleCloseCompare}>
                            ← Back
                        </button>
                    </div>
                </div>
                <CompareModal />
                <EggOverlay />
            </div>
        );
    }

    // ── ROLE SELECTOR ────────────────────────────────────────────────────────
    if (!role) {
        return (
            <div className="quiz-wrapper">
                <div className="role-selector">
                    <h1 className="role-title">Welcome</h1>
                    <p className="role-subtitle">What best describes you?</p>
                    <div className="role-options">
                        <button className="role-btn" onClick={() => setRole("hypnotist")}>
                            <span className="role-icon">✦</span>
                            <span className="role-name">Hypnotist</span>
                            <span className="role-desc">I guide others into trance</span>
                        </button>
                        <button className="role-btn" onClick={() => setRole("subject")}>
                            <span className="role-icon">◯</span>
                            <span className="role-name">Subject</span>
                            <span className="role-desc">I enjoy being hypnotized</span>
                        </button>
                        <button className="role-btn" onClick={() => setRole("switch")}>
                            <span className="role-icon">⇄</span>
                            <span className="role-name">Hypnoswitch</span>
                            <span className="role-desc">I enjoy both roles</span>
                        </button>
                    </div>

                    <div className="update-log">
                        <h3 className="update-log-title">Update Log</h3>
                        <div className="update-log-scroll">
                            <div className="update-entry">
                                <span className="update-date">v11 - Mar 17</span>
                                <ul className="update-list">
                                    <li>You can now save results locally in your browser and load them later</li>
                                    <li>Hypnoswitch results page now has separate collapsible sections for subject and hypnotist responses</li>
                                    <li>Hypnoswitch share codes are now the same length as single-role codes</li>
                                    <li>Hypnoswitch PDF export now generates two separate files (one for each role)</li>
                                    <li>Compare feature now asks which role to use when a hypnoswitch code is detected</li>
                                    <li>Added jump to top button at the bottom of every page</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v10 - Mar 17</span>
                                <ul className="update-list">
                                    <li>Hypnotists now see hypnotist-specific questions and subjects see subject-specific questions</li>
                                    <li>Hypnoswitches see subject questions with a dropdown on each question to answer the hypnotist version separately</li>
                                    <li>If you don't answer the hypnotist dropdown, it inherits your subject answer</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v9 - Mar 15</span>
                                <ul className="update-list">
                                    <li>Something happens when you click or type {wrap67("67")}</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v8 - Mar 15</span>
                                <ul className="update-list">
                                    <li>Your role (SUBJ, TIST, or SWIT) now gets added to the end of your share code and PDF filename</li>
                                    <li>PDF now has alternating row shading so it's easier to read</li>
                                    <li>Added this update log you're reading right now</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v7 - Mar 15</span>
                                <ul className="update-list">
                                    <li>Made the topbar buttons evenly spaced so it looks cleaner</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v6 - Mar 15</span>
                                <ul className="update-list">
                                    <li>Added a compare feature! You can now import two share codes and see what you have in common</li>
                                    <li>The comparison page has 4 dropdown sections: Both Love, Shared Interests, They're Curious About, and They Said No</li>
                                    <li>Each dropdown has a little ? button that explains what it's showing</li>
                                    <li>Fixed the PDF separator lines, they were pushing answers to the next page before</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v4 - Mar 14</span>
                                <ul className="update-list">
                                    <li>Added this role selector page so you can pick if you're a Hypnotist, Subject, or Hypnoswitch</li>
                                    <li>Made the "Curious about" button look different with a dashed purple border so it stands out, and moved it to the end</li>
                                    <li>Added subtle lines between questions in the PDF so it's easier to read</li>
                                    <li>You can now import a share code and edit your answers instead of just viewing them</li>
                                    <li>Added an edit answers button on the results page</li>
                                    <li>The share code now gets embedded at the bottom of exported PDFs so you can always get it back</li>
                                    <li>Your role now shows on the PDF too</li>
                                    <li>Removed "Diapering" and "Watersports" from suggestions</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v3</span>
                                <ul className="update-list">
                                    <li>You can now name your PDF file (e.g. quiz-result-Alice.pdf)</li>
                                    <li>Added a Socials button</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v2</span>
                                <ul className="update-list">
                                    <li>Made the exported share codes way shorter</li>
                                    <li>Old share codes still work, don't worry</li>
                                </ul>
                            </div>
                            <div className="update-entry">
                                <span className="update-date">v1</span>
                                <ul className="update-list">
                                    <li>Fixed the mobile layout</li>
                                    <li>All questions are optional now, you can skip whatever you want</li>
                                    <li>Removed print-as-PNG because it looked bad</li>
                                    <li>Added code importing and exporting so you can share your results</li>
                                    <li>Fixed the PDF export, it was taking way too much space before</li>
                                    <li>Added a Ko-fi button if you wanna support me</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    {savedResults.length > 0 && (
                        <div className="saved-welcome-row">
                            <button className="action-btn primary" onClick={() => setShowSavedModal(true)}>
                                ▤ Load saved results ({savedResults.length})
                            </button>
                        </div>
                    )}
                </div>

                {showSavedModal && (
                    <div className="modal-overlay" onClick={() => setShowSavedModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <h3 className="modal-title">Saved results</h3>
                            <div className="saved-list">
                                {savedResults.map((entry) => (
                                    <div key={entry.id} className="saved-entry">
                                        <div className="saved-entry-info">
                                            <span className="saved-entry-name">{entry.label}</span>
                                            <span className="saved-entry-meta">
                                                {entry.role ? entry.role.charAt(0).toUpperCase() + entry.role.slice(1) : ""}
                                                {" - "}
                                                {new Date(entry.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="saved-entry-actions">
                                            <button className="action-btn primary" onClick={() => loadSavedResult(entry)}>Load</button>
                                            <button className="action-btn" onClick={() => deleteSavedResult(entry.id)}>Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="modal-actions">
                                <button className="action-btn" onClick={() => setShowSavedModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                <EggOverlay />
            </div>
        );
    }

    // ── QUIZ VIEW ─────────────────────────────────────────────────────────────
    if (!submitted) {
        const progressPct = answeredInCurrent / currentCategory.questions.length * 100;

        return (
            <div className="quiz-wrapper">
                <Topbar />

                <nav className="category-strip" aria-label="Progress">
                    {displayCategories.map((cat, i) => {
                        const state =
                            i < catIndex   ? "done"   :
                                i === catIndex ? "active" : "";
                        return (
                            <span key={cat.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                    className={`category-pip ${state}`}
                    onClick={() => goToCategory(i)}
                    title={cat.title}
                >
                  <span className="pip-dot" />
                  <span className="category-pip-label">{cat.title}</span>
                </button>
                                {i < displayCategories.length - 1 && (
                                    <span className="pip-arrow">›</span>
                                )}
              </span>
                        );
                    })}
                </nav>

                <header className="quiz-header">
                    <p className="quiz-category-label">
                        Category {catIndex + 1} of {displayCategories.length}
                    </p>
                    <h1 className="quiz-title">{currentCategory.title}</h1>
                    <p className="quiz-subtitle">{currentCategory.description}</p>
                </header>

                <div className="progress-row">
                    <p className="progress-label">
                        {answeredInCurrent} of {currentCategory.questions.length} answered
                        <span className="skip-hint"> -questions are optional</span>
                    </p>
                    <button className="scroll-bottom-btn" onClick={handleScrollToBottom}>
                        ↓ Jump to bottom
                    </button>
                </div>
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                </div>

                {currentCategory.questions.map((q, i) => {
                    const tistQ = role === "switch" ? tistQMap[q.id] : null;
                    const isDropdownOpen = openTistDropdowns.has(q.id);
                    const hasExplicitTist = tistAnswers[q.id] !== undefined;

                    return (
                        <div
                            key={q.id}
                            className={`question-card${isDropdownOpen ? " tist-open" : ""}`}
                            style={{ animationDelay: `${i * 0.05}s` }}
                        >
                            <div className="question-card-content">
                                <p className="question-number">Q{String(i + 1).padStart(2, "0")}</p>
                                <div className="question-text-wrapper">
                                    <p className="question-text">{wrap67(q.text)}</p>
                                    {q.desc && (
                                        <span
                                            className="tooltip-anchor"
                                            onMouseEnter={() => setActiveTooltip(q.id)}
                                            onMouseLeave={() => setActiveTooltip(null)}
                                        >
                          ?
                                            {activeTooltip === q.id && (
                                                <span className="tooltip-box">{q.desc}</span>
                                            )}
                        </span>
                                    )}
                                </div>

                                <div className="scale-options">
                                    {SCALE.map((opt) => (
                                        <button
                                            key={opt.value}
                                            className={`scale-btn${answers[q.id] === opt.value ? " selected" : ""}${opt.value === 1 ? " curious" : ""}`}
                                            onClick={() => pick(q.id, opt.value)}
                                        >
                                            <span className="dot" />
                                            <span className="scale-label">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {role === "switch" && tistQ && (
                                    <div className="tist-toggle-row">
                                        <button
                                            className={`tist-toggle-btn${isDropdownOpen ? " open" : ""}${hasExplicitTist ? " has-answer" : ""}`}
                                            onClick={() => toggleTistDropdown(q.id)}
                                        >
                                            ⇄ As hypnotist {isDropdownOpen ? "▴" : "▾"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* ── Switch mode: tist dropdown slides out from under ── */}
                            {role === "switch" && tistQ && (
                                <div className={`tist-dropdown-wrapper${isDropdownOpen ? " open" : ""}`}>
                                <div className="tist-dropdown">
                                    <p className="tist-dropdown-header">Hypnotist version</p>
                                    <div className="tist-dropdown-text-wrapper">
                                        <p className="tist-question-text">{wrap67(tistQ.text)}</p>
                                        {tistQ.desc && (
                                            <span
                                                className="tooltip-anchor"
                                                onMouseEnter={() => setActiveTooltip(`tist-${q.id}`)}
                                                onMouseLeave={() => setActiveTooltip(null)}
                                            >
                                                ?
                                                {activeTooltip === `tist-${q.id}` && (
                                                    <span className="tooltip-box">{tistQ.desc}</span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <div className="scale-options">
                                        {SCALE.map((opt) => {
                                            const isExplicit  = tistAnswers[q.id] === opt.value;
                                            const isInherited = !hasExplicitTist && answers[q.id] === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    className={`scale-btn${isExplicit ? " selected" : ""}${isInherited ? " inherited" : ""}${opt.value === 1 ? " curious" : ""}`}
                                                    onClick={() => pickTist(q.id, opt.value)}
                                                >
                                                    <span className="dot" />
                                                    <span className="scale-label">{opt.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className="nav-row" ref={bottomRef}>
                    <button
                        className="nav-btn prev-btn"
                        onClick={handlePrev}
                        disabled={isFirstCategory}
                    >
                        {!isFirstCategory && `← ${displayCategories[catIndex - 1].title}`}
                    </button>

                    <p className="answered-count">
                        <span>{answeredInCurrent}</span> / {currentCategory.questions.length}
                    </p>

                    <button className="nav-btn next-btn active" onClick={handleNext}>
                        {isLastCategory ? "See results →" : `${displayCategories[catIndex + 1].title} →`}
                    </button>
                </div>

                <div className="jump-top-row">
                    <button className="scroll-bottom-btn" onClick={handleScrollToTop}>
                        ↑ Jump to top
                    </button>
                </div>

                {showImportModal && (
                    <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <h3 className="modal-title">Import results</h3>
                            <p className="modal-sub">Paste a share code below to view or edit results.</p>
                            <textarea
                                className="code-box"
                                value={importInput}
                                onChange={(e) => { setImportInput(e.target.value); setImportError(""); }}
                                placeholder="Paste code here…"
                            />
                            {importError && <p className="import-error">{importError}</p>}
                            <div className="modal-actions">
                                <button className="action-btn primary" onClick={() => handleImport(false)}>Load results</button>
                                <button className="action-btn primary" onClick={() => handleImport(true)}>Import &amp; Edit</button>
                                <button className="action-btn" onClick={() => { setShowImportModal(false); setImportError(""); }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
                <CompareModal />
                <EggOverlay />
            </div>
        );
    }

    // ── RESULTS VIEW ──────────────────────────────────────────────────────────
    return (
        <div className="quiz-wrapper">
            <Topbar />

            <div className="results">
                <div className="results-header">
                    <p className="results-eyebrow">Complete</p>
                    <h2 className="results-title">Your Results</h2>
                    <p className="results-sub">
                        {wrap67(`${Object.keys(answers).length} questions answered across ${displayCategories.length} categories`)}
                    </p>
                </div>

                {role === "switch" ? (
                    <>
                        {/* ── Subject responses dropdown ── */}
                        <div className="result-section-toggle" onClick={() => setResultSubOpen((p) => !p)}>
                            <span className="result-section-icon">{resultSubOpen ? "▾" : "▸"}</span>
                            <span className="result-section-label">Subject responses</span>
                        </div>
                        {resultSubOpen && CATEGORIES_SUB.map((cat) => (
                            <div key={cat.id} className="result-category">
                                <p className="result-category-title">{cat.title}</p>
                                {cat.questions.map((q) => {
                                    const val = answers[q.id];
                                    const skipped = val === undefined;
                                    return (
                                        <div key={q.id} className={`result-row${skipped ? " skipped" : ""}`}>
                                            <p className="result-question">{wrap67(q.text)}</p>
                                            <div className="result-bar-track">
                                                {!skipped && <div className="result-bar-fill" style={{ width: `${pctOf(val)}%` }} />}
                                            </div>
                                            <span className="result-value">{skipped ? "-" : labelOf(val)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        {/* ── Hypnotist responses dropdown ── */}
                        <div className="result-section-toggle" onClick={() => setResultTistOpen((p) => !p)}>
                            <span className="result-section-icon">{resultTistOpen ? "▾" : "▸"}</span>
                            <span className="result-section-label">Hypnotist responses</span>
                        </div>
                        {resultTistOpen && CATEGORIES_TIST.map((cat) => (
                            <div key={cat.id} className="result-category result-category-tist">
                                <p className="result-category-title">{cat.title}</p>
                                {cat.questions.map((q) => {
                                    const effectiveVal = tistAnswers[q.id] !== undefined ? tistAnswers[q.id] : answers[q.id];
                                    const skipped = effectiveVal === undefined;
                                    const isInherited = tistAnswers[q.id] === undefined && answers[q.id] !== undefined;
                                    return (
                                        <div key={q.id} className={`result-row${skipped ? " skipped" : ""}${isInherited ? " inherited" : ""}`}>
                                            <p className="result-question">{wrap67(q.text)}</p>
                                            <div className="result-bar-track">
                                                {!skipped && <div className="result-bar-fill tist-fill" style={{ width: `${pctOf(effectiveVal)}%` }} />}
                                            </div>
                                            <span className="result-value result-tist-value">{skipped ? "-" : labelOf(effectiveVal)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </>
                ) : (
                    displayCategories.map((cat) => (
                        <div key={cat.id} className="result-category">
                            <p className="result-category-title">{cat.title}</p>
                            {cat.questions.map((q) => {
                                const val = answers[q.id];
                                const skipped = val === undefined;
                                return (
                                    <div key={q.id} className={`result-row${skipped ? " skipped" : ""}`}>
                                        <p className="result-question">{wrap67(q.text)}</p>
                                        <div className="result-bar-track">
                                            {!skipped && <div className="result-bar-fill" style={{ width: `${pctOf(val)}%` }} />}
                                        </div>
                                        <span className="result-value">{skipped ? "-" : labelOf(val)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}

                <div className="results-actions">
                    <button
                        className="action-btn primary"
                        onClick={handleExportPDF}
                        disabled={exporting}
                    >
                        {exporting ? <><span className="spinner" /> Generating…</> : "↓ Save as PDF"}
                    </button>

                    <button className="action-btn primary" onClick={() => setShowExportModal(true)}>
                        ⬡ Export share code
                    </button>

                    <button className="action-btn primary" onClick={() => { setSaveName(""); setShowSaveModal(true); }}>
                        ▤ Save locally
                    </button>

                    <button className="action-btn primary" onClick={handleEditAnswers}>
                        ✎ Edit answers
                    </button>

                    <button className="action-btn" onClick={handleRetake}>
                        ← Retake quiz
                    </button>
                </div>

                <div className="jump-top-row">
                    <button className="scroll-bottom-btn" onClick={handleScrollToTop}>
                        ↑ Jump to top
                    </button>
                </div>
            </div>

            {showExportModal && (
                <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Share your results</h3>
                        <p className="modal-sub">Copy this code and send it to someone. They can paste it using the Import button.</p>
                        <textarea className="code-box" readOnly value={shareCode} />
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={handleCopy}>
                                {copied ? "✓ Copied!" : "Copy code"}
                            </button>
                            <button className="action-btn" onClick={() => setShowExportModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Import results</h3>
                        <p className="modal-sub">Paste a share code below to view or edit results.</p>
                        <textarea
                            className="code-box"
                            value={importInput}
                            onChange={(e) => { setImportInput(e.target.value); setImportError(""); }}
                            placeholder="Paste code here…"
                        />
                        {importError && <p className="import-error">{importError}</p>}
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={() => handleImport(false)}>Load results</button>
                            <button className="action-btn primary" onClick={() => handleImport(true)}>Import &amp; Edit</button>
                            <button className="action-btn" onClick={() => { setShowImportModal(false); setImportError(""); }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {showPdfModal && (
                <div className="modal-overlay" onClick={() => setShowPdfModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Save as PDF</h3>
                        <p className="modal-sub">
                            Optionally add a name to identify whose results these are.
                            The file will be saved as <strong>quiz-result-NAME.pdf</strong>.
                        </p>
                        <input
                            className="code-box name-input"
                            type="text"
                            value={pdfName}
                            onChange={(e) => setPdfName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleConfirmPDF()}
                            placeholder="e.g. Alice (leave blank to skip)"
                            autoFocus
                        />
                        <p className="privacy-note">🔒 The name is not stored anywhere -it is only used to label the file.</p>
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={handleConfirmPDF}>
                                ↓ Download PDF
                            </button>
                            <button className="action-btn" onClick={() => setShowPdfModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            {showSaveModal && (
                <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Save results locally</h3>
                        <p className="modal-sub">Give this save a name so you can find it later. Saved to your browser's local storage.</p>
                        <input
                            className="code-box name-input"
                            type="text"
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { saveCurrentResults(saveName); setShowSaveModal(false); } }}
                            placeholder="e.g. My results (leave blank for date)"
                            autoFocus
                        />
                        <p className="privacy-note">This uses local storage (cookies) to save your data. By pressing Save, you consent to this.</p>
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={() => { saveCurrentResults(saveName); setShowSaveModal(false); }}>
                                Save
                            </button>
                            <button className="action-btn" onClick={() => setShowSaveModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {showSavedModal && (
                <div className="modal-overlay" onClick={() => setShowSavedModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Saved results</h3>
                        {savedResults.length === 0 ? (
                            <p className="modal-sub">No saved results yet.</p>
                        ) : (
                            <div className="saved-list">
                                {savedResults.map((entry) => (
                                    <div key={entry.id} className="saved-entry">
                                        <div className="saved-entry-info">
                                            <span className="saved-entry-name">{entry.label}</span>
                                            <span className="saved-entry-meta">
                                                {entry.role ? entry.role.charAt(0).toUpperCase() + entry.role.slice(1) : ""}
                                                {" - "}
                                                {new Date(entry.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="saved-entry-actions">
                                            <button className="action-btn primary" onClick={() => loadSavedResult(entry)}>Load</button>
                                            <button className="action-btn" onClick={() => deleteSavedResult(entry.id)}>Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="modal-actions">
                            <button className="action-btn" onClick={() => setShowSavedModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            <CompareModal />
            <EggOverlay />
        </div>
    );
}
