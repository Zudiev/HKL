function SwitchRolePicker({ label, onPick, onCancel }) {
    return (
        <>
            <h3 className="modal-title">{label}</h3>
            <p className="modal-sub">This is a hypnoswitch code. Which role's answers should be used?</p>
            <div className="modal-actions">
                <button className="action-btn primary" onClick={() => onPick("sub")}>Subject</button>
                <button className="action-btn primary" onClick={() => onPick("tist")}>Hypnotist</button>
                <button className="action-btn" onClick={onCancel}>Cancel</button>
            </div>
        </>
    );
}

export default function CompareModal({
    show,
    step,
    myInput,
    theirInput,
    error,
    onMyInputChange,
    onTheirInputChange,
    onNext,
    onMyRole,
    onTheirRole,
    onFinish,
    onBack,
    onClose,
}) {
    if (!show) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                {step === 1 && (
                    <>
                        <h3 className="modal-title">Step 1: Your results</h3>
                        <p className="modal-sub">Paste your own share code below.</p>
                        <textarea
                            className="code-box"
                            value={myInput}
                            onChange={(e) => onMyInputChange(e.target.value)}
                            placeholder="Paste your code here…"
                        />
                        {error && <p className="import-error">{error}</p>}
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={onNext}>Next →</button>
                            <button className="action-btn" onClick={onClose}>Cancel</button>
                        </div>
                    </>
                )}
                {step === 2 && (
                    <SwitchRolePicker label="Your role" onPick={onMyRole} onCancel={onClose} />
                )}
                {step === 3 && (
                    <>
                        <h3 className="modal-title">Step 2: Their results</h3>
                        <p className="modal-sub">Now paste the other person's share code.</p>
                        <textarea
                            className="code-box"
                            value={theirInput}
                            onChange={(e) => onTheirInputChange(e.target.value)}
                            placeholder="Paste their code here…"
                        />
                        {error && <p className="import-error">{error}</p>}
                        <div className="modal-actions">
                            <button className="action-btn primary" onClick={onFinish}>Compare</button>
                            <button className="action-btn" onClick={onBack}>← Back</button>
                            <button className="action-btn" onClick={onClose}>Cancel</button>
                        </div>
                    </>
                )}
                {step === 4 && (
                    <SwitchRolePicker label="Their role" onPick={onTheirRole} onCancel={onClose} />
                )}
            </div>
        </div>
    );
}
