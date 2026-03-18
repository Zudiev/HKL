import { useState, useRef, useEffect, useCallback } from "react";

// ─── MATRIX RAIN CANVAS ─────────────────────────────────────────────────────
function MatrixRain({ opacity = 0.12 }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let animId;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener("resize", resize);

        const fontSize = 14;
        const columns = Math.floor(canvas.width / fontSize);
        const drops = Array.from({ length: columns }, () =>
            Math.random() * -100
        );

        const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF{}[]<>/\\|!@#$%^&*()_+-=~`".split("");

        const draw = () => {
            ctx.fillStyle = `rgba(0, 0, 0, 0.05)`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < drops.length; i++) {
                const char = chars[Math.floor(Math.random() * chars.length)];
                const x = i * fontSize;
                const y = drops[i] * fontSize;

                // head of the drop is brighter
                const brightness = Math.random();
                if (brightness > 0.95) {
                    ctx.fillStyle = "#ffffff";
                    ctx.shadowColor = "#00ff41";
                    ctx.shadowBlur = 15;
                } else if (brightness > 0.8) {
                    ctx.fillStyle = "#00ff41";
                    ctx.shadowColor = "#00ff41";
                    ctx.shadowBlur = 8;
                } else {
                    ctx.fillStyle = `rgba(0, 255, 65, ${0.3 + Math.random() * 0.4})`;
                    ctx.shadowBlur = 0;
                }

                ctx.font = `${fontSize}px monospace`;
                ctx.fillText(char, x, y);
                ctx.shadowBlur = 0;

                if (y > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
            animId = requestAnimationFrame(draw);
        };

        draw();
        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none",
                opacity,
            }}
        />
    );
}

// ─── FAKE TERMINAL ──────────────────────────────────────────────────────────
const HACKER_LINES = [
    { delay: 0,    text: "$ ssh root@192.168.1.337 -p 4444", type: "cmd" },
    { delay: 600,  text: "Connecting to target...", type: "info" },
    { delay: 1200, text: "[OK] Connection established", type: "success" },
    { delay: 1800, text: "$ sudo nmap -sV -O --script=vuln 10.0.0.0/24", type: "cmd" },
    { delay: 2400, text: "Starting Nmap 7.94 ( https://nmap.org )", type: "info" },
    { delay: 2800, text: "Discovered open port 443/tcp on 10.0.0.67", type: "warn" },
    { delay: 3200, text: "Discovered open port 22/tcp on 10.0.0.67", type: "warn" },
    { delay: 3600, text: "Discovered open port 8080/tcp on 10.0.0.67", type: "warn" },
    { delay: 4000, text: "$ python3 exploit.py --target 10.0.0.67 --payload reverse_shell", type: "cmd" },
    { delay: 4600, text: "[*] Generating polymorphic shellcode...", type: "info" },
    { delay: 5200, text: "[*] Bypassing WAF with encoding: shikata_ga_nai x5", type: "info" },
    { delay: 5800, text: "[*] Injecting payload into memory at 0xDEADBEEF", type: "info" },
    { delay: 6400, text: "[+] SHELL OBTAINED - root@target:~#", type: "success" },
    { delay: 7000, text: "# cat /etc/shadow | hashcat -m 1800 -a 0 rockyou.txt", type: "cmd" },
    { delay: 7600, text: "[*] Cracking hashes... 47,293 H/s", type: "info" },
    { delay: 8200, text: "[+] admin:$6$rAnD0m$... -> password123", type: "success" },
    { delay: 8800, text: "[+] root:$6$s3cUr3$...  -> hunter2", type: "success" },
    { delay: 9400, text: "# exfiltrating quiz_preferences.db ...", type: "warn" },
    { delay: 10000, text: "[████████████████████████████████] 100%", type: "success" },
    { delay: 10600, text: "[+] ALL YOUR KINKS ARE BELONG TO US", type: "success" },
    { delay: 11200, text: "# rm -rf /var/log/* && history -c", type: "cmd" },
    { delay: 11800, text: "[*] Covering tracks... traces eliminated", type: "info" },
    { delay: 12400, text: "[+] MISSION COMPLETE. Zero footprint achieved.", type: "success" },
    { delay: 13000, text: "", type: "spacer" },
    { delay: 13200, text: "▓▓▓ HACKER MODE: ACTIVATED ▓▓▓", type: "title" },
];

function FakeTerminal({ onComplete }) {
    const [lines, setLines] = useState([]);
    const [showCursor, setShowCursor] = useState(true);
    const termRef = useRef(null);

    useEffect(() => {
        const timers = HACKER_LINES.map((line, i) =>
            setTimeout(() => {
                setLines((prev) => [...prev, line]);
                if (termRef.current) {
                    termRef.current.scrollTop = termRef.current.scrollHeight;
                }
                if (i === HACKER_LINES.length - 1) {
                    setTimeout(() => onComplete?.(), 1500);
                }
            }, line.delay)
        );

        const cursorInterval = setInterval(() => {
            setShowCursor((p) => !p);
        }, 530);

        return () => {
            timers.forEach(clearTimeout);
            clearInterval(cursorInterval);
        };
    }, [onComplete]);

    const getColor = (type) => {
        switch (type) {
            case "cmd": return "#00ff41";
            case "info": return "#00bfff";
            case "success": return "#39ff14";
            case "warn": return "#ffcc00";
            case "title": return "#ff0040";
            default: return "#00ff41";
        }
    };

    return (
        <div className="hacker-terminal-overlay">
            <div className="hacker-terminal" ref={termRef}>
                <div className="hacker-terminal-header">
                    <span className="hacker-dot red" />
                    <span className="hacker-dot yellow" />
                    <span className="hacker-dot green" />
                    <span className="hacker-terminal-title">root@kali:~</span>
                </div>
                <div className="hacker-terminal-body">
                    {lines.map((line, i) => (
                        <div
                            key={i}
                            className="hacker-line"
                            style={{
                                color: getColor(line.type),
                                fontWeight: line.type === "title" ? 900 : 400,
                                fontSize: line.type === "title" ? "1.1rem" : "0.78rem",
                                letterSpacing: line.type === "title" ? "0.3em" : "0.02em",
                                textAlign: line.type === "title" ? "center" : "left",
                                textShadow: line.type === "title" ? "0 0 20px #ff0040, 0 0 40px #ff0040" : "none",
                            }}
                        >
                            {line.text}
                        </div>
                    ))}
                    <span
                        className="hacker-cursor"
                        style={{ opacity: showCursor ? 1 : 0 }}
                    >
                        █
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── GLITCH TEXT ────────────────────────────────────────────────────────────
function GlitchText({ text, className = "" }) {
    return (
        <span className={`glitch-text ${className}`} data-text={text}>
            {text}
        </span>
    );
}

// ─── SCANLINE OVERLAY ───────────────────────────────────────────────────────
function Scanlines() {
    return <div className="hacker-scanlines" />;
}

// ─── FLOATING STATS ─────────────────────────────────────────────────────────
function FloatingStats() {
    const [stats, setStats] = useState({
        cpu: 67,
        mem: 42,
        net: 1337,
        threats: 0,
        encrypted: 100,
        uptime: 0,
    });

    useEffect(() => {
        const interval = setInterval(() => {
            setStats((prev) => ({
                cpu: Math.min(99, Math.max(15, prev.cpu + (Math.random() * 20 - 10) | 0)),
                mem: Math.min(95, Math.max(20, prev.mem + (Math.random() * 10 - 5) | 0)),
                net: Math.max(0, prev.net + (Math.random() * 500 - 200) | 0),
                threats: prev.threats + (Math.random() > 0.85 ? 1 : 0),
                encrypted: 100,
                uptime: prev.uptime + 1,
            }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="hacker-floating-stats">
            <div className="hacker-stat">
                <span className="hacker-stat-label">CPU</span>
                <div className="hacker-stat-bar">
                    <div
                        className="hacker-stat-fill"
                        style={{
                            width: `${stats.cpu}%`,
                            background: stats.cpu > 80 ? "#ff0040" : "#00ff41",
                        }}
                    />
                </div>
                <span className="hacker-stat-val">{stats.cpu}%</span>
            </div>
            <div className="hacker-stat">
                <span className="hacker-stat-label">MEM</span>
                <div className="hacker-stat-bar">
                    <div
                        className="hacker-stat-fill"
                        style={{ width: `${stats.mem}%` }}
                    />
                </div>
                <span className="hacker-stat-val">{stats.mem}%</span>
            </div>
            <div className="hacker-stat">
                <span className="hacker-stat-label">NET</span>
                <span className="hacker-stat-val net">{stats.net} kb/s</span>
            </div>
            <div className="hacker-stat">
                <span className="hacker-stat-label">THREATS</span>
                <span className="hacker-stat-val threats">{stats.threats}</span>
            </div>
            <div className="hacker-stat">
                <span className="hacker-stat-label">UPTIME</span>
                <span className="hacker-stat-val">{stats.uptime}s</span>
            </div>
        </div>
    );
}

// ─── HOOK: useHackerMode ────────────────────────────────────────────────────
export function useHackerMode() {
    const [hackerActive, setHackerActive] = useState(false);
    const [hackerBooting, setHackerBooting] = useState(false);
    const keyBuf = useRef("");
    const keyTimer = useRef(null);

    const triggerHacker = useCallback(() => {
        if (hackerActive) {
            // toggle off
            setHackerActive(false);
            setHackerBooting(false);
            document.documentElement.classList.remove("hacker-mode");
            return;
        }
        // boot sequence
        setHackerBooting(true);
        document.documentElement.classList.add("hacker-mode");
    }, [hackerActive]);

    const onBootComplete = useCallback(() => {
        setHackerBooting(false);
        setHackerActive(true);
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            keyBuf.current += e.key.toLowerCase();
            clearTimeout(keyTimer.current);
            keyTimer.current = setTimeout(() => { keyBuf.current = ""; }, 1200);
            if (keyBuf.current.includes("hack")) {
                keyBuf.current = "";
                triggerHacker();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [triggerHacker]);

    return { hackerActive, hackerBooting, triggerHacker, onBootComplete };
}

// ─── OVERLAY COMPONENT ─────────────────────────────────────────────────────
export function HackerOverlay({ hackerActive, hackerBooting, onBootComplete }) {
    if (hackerBooting) {
        return <FakeTerminal onComplete={onBootComplete} />;
    }
    if (!hackerActive) return null;
    return (
        <>
            <MatrixRain opacity={0.08} />
            <Scanlines />
            <FloatingStats />
        </>
    );
}

export { GlitchText };