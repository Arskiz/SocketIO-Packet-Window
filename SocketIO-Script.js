// Inject socket capture into real page context
(function () {
    'use strict';

    // --- CONFIG MANAGER (Persistent Storage) ---
    const Config = {
        get(key, defaultVal) {
            return GM_getValue(key, defaultVal);
        },
        set(key, val) {
            GM_setValue(key, val);
        }
    };

    const sendPacket = (command, data = {}) => {
        const packet = {
            type: 2,
            data: ['message', command, data],
            options: { compress: true },
            nsp: '/'
        };
        const encoded = msgpack.encode(packet);
        unsafeWindow._MM_sendRaw(encoded);
    };

    const AudioFX = {
        ctx: null,
        init() {
            if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        },
        playClick() {
            this.init();
            const ctx = this.ctx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
        },
        playToggle(isOn) {
            this.init();
            const ctx = this.ctx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            const startFreq = isOn ? 400 : 300;
            const endFreq = isOn ? 800 : 150;

            osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.12);

            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        }
    };

    function initMenu() {
        const ModMenu = (() => {
            const style = `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

                :root { 
                    --mm-theme: ${Config.get('theme_color', '#ff2a2a')};
                    --mm-title: ${Config.get('title_color', '#ffffff')};
                    --mm-bg: rgba(15, 15, 20, 0.65);
                    --mm-border: rgba(255, 255, 255, 0.08);
                    --mm-text: #e2e8f0;
                    --mm-muted: #94a3b8;
                    --mm-surface: rgba(255, 255, 255, 0.04);
                    --mm-surface-hover: rgba(255, 255, 255, 0.08);
                }

                .mm-box {
                    position: fixed;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    background: var(--mm-bg) !important;
                    backdrop-filter: blur(24px) saturate(180%) !important;
                    -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
                    border: 1px solid var(--mm-border) !important;
                    border-radius: 16px;
                    min-width: 300px;
                    z-index: 999999;
                    box-shadow: 0 30px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
                    user-select: none;
                    transition: max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    max-height: 850px;
                    overflow: hidden;
                    color: var(--mm-text);
                }

                .mm-header {
                    background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%) !important;
                    border-bottom: 1px solid var(--mm-border);
                    padding: 14px 18px;
                    display: flex;
                    align-items: center;
                    cursor: grab;
                    gap: 10px;
                }
                .mm-header:active { cursor: grabbing; }

                .mm-title {
                    flex: 1;
                    color: var(--mm-title);
                    font-size: 14px;
                    font-weight: 700;
                    letter-spacing: 0.2px;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                }

                .mm-btn-close, .mm-btn-min {
                    width: 14px; height: 14px;
                    border-radius: 50%;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: transparent;
                    transition: all 0.2s ease;
                    position: relative;
                }
                .mm-btn-min { background: #f5a623; }
                .mm-btn-close { background: #ff4757; }
                
                .mm-btn-close:hover, .mm-btn-min:hover {
                    color: rgba(0,0,0,0.6);
                    transform: scale(1.1);
                }
                .mm-btn-min::before { content: "−"; font-size: 12px; font-weight: 900; line-height: 0; }
                .mm-btn-close::before { content: "×"; font-size: 12px; font-weight: 900; line-height: 0; }

                .mm-tabs {
                    display: flex;
                    background: rgba(0,0,0,0.2);
                    margin: 12px 14px;
                    padding: 4px;
                    border-radius: 10px;
                    gap: 4px;
                }
                .mm-tab {
                    flex: 1;
                    text-align: center;
                    padding: 8px 0;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--mm-muted);
                    cursor: pointer;
                    border-radius: 6px;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .mm-tab:hover { color: #fff; background: var(--mm-surface); }
                .mm-tab.active {
                    color: #fff;
                    background: var(--mm-surface-hover);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }

                .mm-body {
                    padding: 0 16px 16px 16px;
                    opacity: 0;
                    transform: translateY(8px) scale(0.98);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    display: none;
                }
                .mm-body.active {
                    display: block;
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }

                .mm-section {
                    margin-bottom: 20px;
                    background: rgba(0,0,0,0.15);
                    padding: 14px;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.03);
                }
                .mm-section-title {
                    font-size: 10px;
                    font-weight: 800;
                    color: var(--mm-theme);
                    text-transform: uppercase;
                    letter-spacing: 1.2px;
                    margin-bottom: 4px;
                }
                .mm-subtitle {
                    font-size: 11px;
                    color: var(--mm-muted);
                    margin-bottom: 12px;
                    font-weight: 500;
                }

                .mm-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    gap: 12px;
                }
                .mm-label {
                    font-size: 13px;
                    color: #f1f5f9;
                    font-weight: 500;
                    flex: 1;
                }

                /* Beautiful Modern Toggles */
                .mm-cb-wrap {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    margin-bottom: 10px;
                    padding: 6px 0;
                }
                .mm-cb-wrap input { display: none; }
                .mm-cb-box {
                    width: 36px;
                    height: 20px;
                    background: #2a2a35;
                    border-radius: 20px;
                    position: relative;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .mm-cb-box::after {
                    content: '';
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 14px;
                    height: 14px;
                    background: #fff;
                    border-radius: 50%;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .mm-cb-wrap input:checked + .mm-cb-box {
                    background: var(--mm-theme);
                    box-shadow: 0 0 12px var(--mm-theme), inset 0 2px 4px rgba(0,0,0,0.2);
                }
                .mm-cb-wrap input:checked + .mm-cb-box::after {
                    transform: translateX(16px);
                }

                /* Sleek Inputs */
                .mm-input-el {
                    background: rgba(0,0,0,0.25) !important;
                    border: 1px solid var(--mm-border) !important;
                    color: #fff !important;
                    font-size: 12px !important;
                    font-weight: 600 !important;
                    padding: 8px 12px !important;
                    border-radius: 8px !important;
                    outline: none !important;
                    font-family: 'Inter', sans-serif !important;
                    text-align: center !important;
                    transition: all 0.2s ease !important;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.2) !important;
                }
                .mm-input-el:hover { border-color: rgba(255,255,255,0.15) !important; }
                .mm-input-el:focus {
                    border-color: var(--mm-theme) !important;
                    background: rgba(0,0,0,0.4) !important;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.2), 0 0 0 3px rgba(255,255,255,0.05) !important;
                }

                /* Sexy Buttons */
                .mm-btn-el {
                    padding: 10px 14px;
                    background: var(--mm-surface);
                    border: 1px solid var(--mm-border);
                    color: #fff;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    border-radius: 8px;
                    width: 100%;
                    text-align: center;
                    margin-bottom: 10px;
                    display: block;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                    overflow: hidden;
                }
                .mm-btn-el::before {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%);
                    opacity: 0; transition: opacity 0.2s ease;
                }
                .mm-btn-el:hover {
                    background: var(--mm-surface-hover);
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(0,0,0,0.2);
                }
                .mm-btn-el:hover::before { opacity: 1; }
                .mm-btn-el:active { transform: translateY(1px); }
                
                .mm-btn-el.green { color: #10b981; border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.05); }
                .mm-btn-el.green:hover { box-shadow: 0 4px 16px rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); }
                
                .mm-btn-el.blue { color: #3b82f6; border-color: rgba(59, 130, 246, 0.2); background: rgba(59, 130, 246, 0.05); }
                .mm-btn-el.blue:hover { box-shadow: 0 4px 16px rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.4); }
                
                .mm-btn-el.red { color: #ef4444; border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); }
                .mm-btn-el.red:hover { box-shadow: 0 4px 16px rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4); }
                
                .mm-btn-el.yellow { color: #f59e0b; border-color: rgba(245, 158, 11, 0.2); background: rgba(245, 158, 11, 0.05); }
                .mm-btn-el.yellow:hover { box-shadow: 0 4px 16px rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.4); }

                /* Dropdown Overhaul */
                .mm-dropdown-container { margin-bottom: 14px; position: relative; }
                .mm-dropdown-trigger {
                    background: rgba(0,0,0,0.25);
                    border: 1px solid var(--mm-border);
                    color: #fff;
                    padding: 10px 14px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    width: 100%;
                    transition: all 0.2s ease;
                }
                .mm-dropdown-trigger:hover {
                    border-color: var(--mm-theme);
                    background: rgba(0,0,0,0.4);
                }
                .mm-dropdown-menu {
                    position: absolute;
                    top: calc(100% + 6px);
                    left: 0;
                    width: 100%;
                    background: rgba(20, 20, 25, 0.95);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 10px;
                    max-height: 240px;
                    overflow-y: auto;
                    z-index: 10000;
                    display: none;
                    box-shadow: 0 16px 40px rgba(0,0,0,0.6);
                }
                .mm-box:has(.mm-dropdown-menu.open) {
                    overflow: visible !important;
                    max-height: none !important;
                }
                .mm-dropdown-menu.open {
                    display: block;
                    animation: dd-slide 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .mm-dropdown-menu::-webkit-scrollbar { width: 4px; }
                .mm-dropdown-menu::-webkit-scrollbar-track { background: transparent; }
                .mm-dropdown-menu::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
                .mm-dropdown-menu::-webkit-scrollbar-thumb:hover { background: var(--mm-theme); }

                .mm-dropdown-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 14px;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    gap: 12px;
                    transition: all 0.2s ease;
                }
                .mm-dropdown-item:hover { background: rgba(255,255,255,0.05); padding-left: 18px; }
                .mm-dropdown-item:last-child { border-bottom: none; }

                .mm-dd-title { font-size: 12px; color: #f1f5f9; font-weight: 600; flex: 2; }
                .mm-dd-id {
                    font-size: 10px;
                    color: var(--mm-muted);
                    background: rgba(0,0,0,0.4);
                    padding: 3px 6px;
                    border-radius: 4px;
                    font-family: 'JetBrains Mono', monospace;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .mm-dd-join-btn {
                    padding: 5px 12px;
                    background: var(--mm-theme);
                    border: none;
                    color: #fff;
                    font-size: 11px;
                    font-weight: 700;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                .mm-dd-join-btn:hover {
                    filter: brightness(1.15);
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px var(--mm-theme);
                }

                @keyframes dd-slide {
                    0% { opacity: 0; transform: translateY(-8px) scale(0.98); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }

                /* Footer Polish */
                .mm-footer {
                    background: rgba(0, 0, 0, 0.2) !important;
                    border-top: 1px solid var(--mm-border);
                    padding: 10px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-radius: 0 0 16px 16px;
                }
                .mm-status-label { font-size: 10px; color: var(--mm-muted); font-weight: 700; letter-spacing: 0.5px; }
                .mm-status-wrapper { display: flex; align-items: center; gap: 8px; }
                .mm-status-text { font-size: 11px; font-weight: 800; letter-spacing: 0.5px; }
                .mm-status-text.connected { color: #10b981; text-shadow: 0 0 10px rgba(16,185,129,0.4); }
                .mm-status-text.disconnected { color: #ef4444; text-shadow: 0 0 10px rgba(239,68,68,0.4); }
                .mm-status-dot { width: 8px; height: 8px; border-radius: 50%; }
                .mm-status-dot.connected { background: #10b981; box-shadow: 0 0 8px #10b981; }
                .mm-status-dot.disconnected { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
            `;

            function inject() {
                let s = document.getElementById('mm-style');
                if (!s) {
                    s = document.createElement('style');
                    s.id = 'mm-style';
                    document.head.appendChild(s);
                }
                s.textContent = style;
            }

            function Window(title, opts = {}) {
                inject();
                const box = document.createElement('div');
                box.className = 'mm-box';

                const savedX = Config.get('menu_x', null);
                const savedY = Config.get('menu_y', '20px');
                box.style.cssText = `
                    width: ${opts.width || '360px'};
                    top: ${savedY};
                    left: ${savedX ? savedX : (opts.x === 'right' ? 'auto' : (opts.x || '20px'))};
                    right: ${savedX ? 'auto' : (opts.x === 'right' ? '20px' : 'auto')};
                `;

                const header = document.createElement('div');
                header.className = 'mm-header';
                header.innerHTML = `<span class="mm-title">${title}</span>