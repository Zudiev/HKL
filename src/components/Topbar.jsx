export default function Topbar({ onImport, onCompare }) {
    return (
        <div className="topbar">
            <button className="import-btn" onClick={onImport}>
                ↑ Import results
            </button>
            <button className="compare-btn" onClick={onCompare}>
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
}
