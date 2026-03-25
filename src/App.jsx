import { useState, useMemo, useRef, useEffect } from "react";
import "./quiz.css";
import { CATEGORIES as CATEGORIES_DEFAULT, SCALE } from "./questions/questions.js";
import { CATEGORIES as CATEGORIES_SUB } from "./questions/questionsSub.js";
import { CATEGORIES as CATEGORIES_TIST } from "./questions/questionsTist.js";

// ─── EXTRACTED UTILS ─────────────────────────────────────────────────────────
import { labelOf, pctOf } from "./utils/helpers.js";
import { encodeAnswers, decodeAnswers } from "./utils/shareCode.js";
import { exportAsPDF } from "./utils/pdfExport.js";

// ─── EXTRACTED COMPONENTS ────────────────────────────────────────────────────
import { useEasterEgg, EggOverlay } from "./components/EasterEgg.jsx";
import { useHackerMode, HackerOverlay } from "./components/HackerMode.jsx";
import Topbar from "./components/Topbar.jsx";
import CompareModal from "./components/CompareModal.jsx";
import UpdateLog from "./components/UpdateLog.jsx";

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
    const [openSections,       setOpenSections]       = useState({ 0: true, 1: false, 2: false, 3: false, 4: false });
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

    // ── DYSLEXIA MODE ───────────────────────────────────────────────────────
    const [dyslexia, setDyslexia] = useState(() => localStorage.getItem("dyslexiaMode") === "true");
    useEffect(() => {
        document.documentElement.classList.toggle("dyslexia-mode", dyslexia);
        localStorage.setItem("dyslexiaMode", dyslexia);
    }, [dyslexia]);

    // ── HIGH CONTRAST MODE ──────────────────────────────────────────────────
    const [highContrast, setHighContrast] = useState(() => localStorage.getItem("highContrastMode") === "true");
    useEffect(() => {
        document.documentElement.classList.toggle("high-contrast", highContrast);
        localStorage.setItem("highContrastMode", highContrast);
    }, [highContrast]);

    // ── EASTER EGG HOOK ─────────────────────────────────────────────────────
    const { eggMedia, eggFading, handleVideoEnd, wrap67 } = useEasterEgg();

    // ── HACKER MODE HOOK ──────────────────────────────────────────────────────
    const { hackerActive, hackerBooting, onBootComplete } = useHackerMode();

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
        setOpenSections({ 0: true, 1: false, 2: false, 3: false, 4: false });
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
        const bothLikeOrLove = allQs.filter((q) => {
            const my = compareMyAnswers[q.id];
            const their = compareTheirAnswers[q.id];
            return my >= 4 && their >= 4 && !(my === 5 && their === 5);
        });
        const sharedInterest = allQs.filter((q) => {
            const my = compareMyAnswers[q.id];
            const their = compareTheirAnswers[q.id];
            return my >= 2 && my <= 4 && their >= 2 && their <= 4;
        });
        const theirCurious = allQs.filter((q) => compareTheirAnswers[q.id] === 1);
        const theirNo = allQs.filter((q) => compareTheirAnswers[q.id] === 0);

        return { bothLove, bothLikeOrLove, sharedInterest, theirCurious, theirNo };
    }, [compareMyAnswers, compareTheirAnswers, displayCategories]);

    const SECTIONS = [
        { title: "Both Love",               help: "Questions that both you and the other person answered as \"Love\" — your strongest shared interests." },
        { title: "Both Like or Love",        help: "Questions where both of you answered \"Like\" or \"Love\" (but not both \"Love\") — strong mutual interest." },
        { title: "Shared Interests",         help: "Questions where both of you answered Maybe, Okay, or Like (values 2-4) — things you're both moderately into." },
        { title: "They're Curious About",    help: "Questions the other person marked as \"Curious about\" — things they'd like to explore." },
        { title: "They Said No",             help: "Questions the other person answered \"No\" — their hard limits or disinterests." },
    ];

    const sectionItems = compareData
        ? [compareData.bothLove, compareData.bothLikeOrLove, compareData.sharedInterest, compareData.theirCurious, compareData.theirNo]
        : [[], [], [], [], []];

    // ── Shared modal/overlay props ───────────────────────────────────────────
    const eggOverlayProps = { eggMedia, eggFading, handleVideoEnd };
    const hackerOverlayProps = { hackerActive, hackerBooting, onBootComplete };
    const topbarProps = {
        onImport: () => setShowImportModal(true),
        onCompare: handleOpenCompare,
    };
    const compareModalProps = {
        show: showCompareModal,
        step: compareStep,
        myInput: compareMyInput,
        theirInput: compareTheirInput,
        error: compareError,
        onMyInputChange: (v) => { setCompareMyInput(v); setCompareError(""); },
        onTheirInputChange: (v) => { setCompareTheirInput(v); setCompareError(""); },
        onNext: handleCompareNext,
        onMyRole: handleCompareMyRole,
        onTheirRole: handleCompareTheirRole,
        onFinish: handleCompareFinish,
        onBack: () => { setCompareStep(1); setCompareError(""); },
        onClose: () => setShowCompareModal(false),
    };

    // ── COMPARE VIEW ──────────────────────────────────────────────────────────
    if (compareView && compareData) {
        return (
            <div className="quiz-wrapper">
                <Topbar {...topbarProps} />
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
                <CompareModal {...compareModalProps} />
                <EggOverlay {...eggOverlayProps} />
                <HackerOverlay {...hackerOverlayProps} />
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

                    <div className="a11y-toggles">
                        <button
                            className={`a11y-btn${dyslexia ? " active" : ""}`}
                            onClick={() => setDyslexia(d => !d)}
                        >
                            <span className="a11y-btn-icon">Aa</span>
                            {dyslexia ? "Dyslexia-friendly on" : "Dyslexia-friendly"}
                        </button>
                        <button
                            className={`a11y-btn${highContrast ? " active" : ""}`}
                            onClick={() => setHighContrast(h => !h)}
                        >
                            <span className="a11y-btn-icon">◐</span>
                            {highContrast ? "High contrast on" : "High contrast"}
                        </button>
                    </div>

                    <UpdateLog wrap67={wrap67} />

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

                <EggOverlay {...eggOverlayProps} />
                <HackerOverlay {...hackerOverlayProps} />
            </div>
        );
    }

    // ── QUIZ VIEW ─────────────────────────────────────────────────────────────
    if (!submitted) {
        const progressPct = answeredInCurrent / currentCategory.questions.length * 100;

        return (
            <div className="quiz-wrapper">
                <Topbar {...topbarProps} />

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
                <CompareModal {...compareModalProps} />
                <EggOverlay {...eggOverlayProps} />
                <HackerOverlay {...hackerOverlayProps} />
            </div>
        );
    }

    // ── RESULTS VIEW ──────────────────────────────────────────────────────────
    return (
        <div className="quiz-wrapper">
            <Topbar {...topbarProps} />

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

            <CompareModal {...compareModalProps} />
            <EggOverlay {...eggOverlayProps} />
            <HackerOverlay {...hackerOverlayProps} />
        </div>
    );
}
