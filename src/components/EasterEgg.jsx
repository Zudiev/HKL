import { useState, useRef, useEffect, useCallback } from "react";

// ─── EASTER EGG ASSETS ───────────────────────────────────────────────────
import vineBoom from "../assets/sounds/vine-boom.mp3";
import img1 from "../assets/Shush.jpg";
import img2 from "../assets/FUCK.png";
import img3 from "../assets/3E999D72-B7F7-4B68-A696-64161760C5F3.gif";
import img4 from "../assets/G8lXTj7WQAAGD1H.png";
import vid1 from "../assets/WKno0Ci.mp4";

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

// Custom hook for easter egg logic
export function useEasterEgg() {
    const [eggMedia, setEggMedia]   = useState(null);
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
    const wrap67 = useCallback((text) => {
        if (typeof text !== "string" || !text.includes("67")) return text;
        const parts = text.split(/(67)/g);
        return parts.map((p, i) =>
            p === "67" ? (
                <span key={i} className="clickable-67" onClick={trigger67}>67</span>
            ) : p
        );
    }, [trigger67]);

    return { eggMedia, eggFading, trigger67, handleVideoEnd, wrap67 };
}

// Overlay component
export function EggOverlay({ eggMedia, eggFading, handleVideoEnd }) {
    if (!eggMedia) return null;
    return (
        <div className={`egg-overlay${eggFading ? " fading" : ""}`}>
            {eggMedia.type === "video" ? (
                <video className="egg-media" src={eggMedia.src} autoPlay onEnded={handleVideoEnd} />
            ) : (
                <img className="egg-media" src={eggMedia.src} alt="" />
            )}
        </div>
    );
}
