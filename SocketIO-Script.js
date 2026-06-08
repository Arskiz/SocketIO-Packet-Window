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
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

                :root { 
                    --mm-theme: ${Config.get('theme_color', '#ff2a5f')};
                    --mm-title: ${Config.get('title_color', '#ffffff')};
                    --mm-bg: rgba(12, 12, 14, 0.65);
                    --mm-surface: rgba(255, 255, 255, 0.03);
                    --mm-border: rgba(255, 255, 255, 0.08);
                }

                .mm-box {
                    position: fixed;
                    font-family: 'Inter', Arial, sans-serif;
                    background: var(--mm-bg) !important;
                    backdrop-filter: blur(24px) saturate(180%) !important;
                    -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
                    border: 1px solid var(--mm-border) !important;
                    border-radius: 16px;
                    min-width: 320px;
                    z-index: 999999;
                    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
                    user-select: none;
                    transition: max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    max-height: 850px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .mm-header {
                    background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%) !important;
                    border-bottom: 1px solid var(--mm-border);
                    padding: 12px 16px;
                    height: auto;
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
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    text-shadow: 0 0 10px rgba(255,255,255,0.2);
                }

                .mm-btn-close, .mm-btn-min {
                    width: 14px; height: 14px;
                    border-radius: 50%; border: none; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s ease;
                    font-size: 0;
                    opacity: 0.7;
                }
                .mm-btn-close { background: #ff4757; box-shadow: 0 0 8px rgba(255, 71, 87, 0.4); margin-left: auto; }
                .mm-btn-min { background: #ffa502; box-shadow: 0 0 8px rgba(255, 165, 2, 0.4); margin-left: 6px; }
                .mm-btn-close:hover, .mm-btn-min:hover { opacity: 1; transform: scale(1.2); }

                .mm-tabs {
                    display: flex;
                    padding: 12px 16px 0;
                    gap: 8px;
                    border-bottom: 1px solid transparent;
                    background: transparent;
                }
                .mm-tab {
                    padding: 6px 14px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #7a7a8c;
                    cursor: pointer;
                    background: transparent;
                    border-radius: 20px;
                    border: none;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .mm-tab:hover { color: #fff; background: rgba(255, 255, 255, 0.05); }
                .mm-tab.active {
                    color: #fff;
                    background: var(--mm-theme);
                    box-shadow: 0 4px 15px var(--mm-theme);
                    text-shadow: 0 1px 2px rgba(0,0,0,0.4);
                    border: none;
                }

                .mm-body {
                    padding: 16px;
                    opacity: 0;
                    transform: translateY(10px);
                    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    display: none;
                    flex: 1;
                    overflow-y: auto;
                    font-family: 'Inter', Arial, sans-serif;
                }
                .mm-body.active {
                    display: block;
                    opacity: 1;
                    transform: translateY(0);
                }
                
                .mm-body::-webkit-scrollbar { width: 4px; }
                .mm-body::-webkit-scrollbar-track { background: transparent; }
                .mm-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .mm-body::-webkit-scrollbar-thumb:hover { background: var(--mm-theme); }

                .mm-section { margin-bottom: 20px; }
                .mm-section-title {
                    font-size: 11px;
                    font-weight: 800;
                    color: var(--mm-theme);
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border: none;
                    padding-bottom: 0;
                }
                .mm-section-title::after {
                    content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, var(--mm-theme), transparent);
                    opacity: 0.3;
                }
                .mm-subtitle { font-size: 11px; color: #666; margin-bottom: 12px; margin-top: -6px; }

                .mm-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 12px; }
                .mm-label { font-size: 13px; color: #a0a0b0; flex: 1; font-weight: 600; }

                .mm-btn-el {
                    padding: 10px 14px;
                    background: var(--mm-surface) !important;
                    border: 1px solid var(--mm-border) !important;
                    color: #fff !important;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    border-radius: 8px;
                    width: 100%;
                    text-align: left;
                    margin-bottom: 8px;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
                    backdrop-filter: blur(4px);
                    display: block;
                }
                .mm-btn-el:hover {
                    background: rgba(255, 255, 255, 0.08) !important;
                    border-color: var(--mm-theme) !important;
                    transform: translateY(-2px) scale(1.01) !important;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.4), 0 0 10px var(--mm-theme) inset !important;
                }
                .mm-btn-el:active { transform: translateY(1px) scale(0.98) !important; }
                
                .mm-btn-el.green { color:#00ff88 !important; border-color:#00ff8833 !important; }
                .mm-btn-el.blue { color:#33b5e5 !important; border-color:#33b5e533 !important; }
                .mm-btn-el.red { color:#ff4444 !important; border-color:#ff444433 !important; }
                .mm-btn-el.yellow { color:#ffcc00 !important; border-color:#ffcc0033 !important; }

                .mm-input-el {
                    background: rgba(0,0,0,0.3) !important;
                    border: 1px solid var(--mm-border) !important;
                    color: #fff !important;
                    font-size: 13px !important;
                    font-weight: 600 !important;
                    border-radius: 6px !important;
                    outline: none !important;
                    padding: 8px 12px !important;
                    font-family: 'Inter', Arial, sans-serif !important;
                    text-align: center !important;
                    transition: all 0.3s ease !important;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.5) !important;
                    margin-bottom: 0;
                }
                .mm-input-el:hover { background: rgba(0,0,0,0.5) !important; border-color: rgba(255,255,255,0.2) !important; }
                .mm-input-el:focus {
                    border-color: var(--mm-theme) !important;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 0 12px var(--mm-theme) !important;
                    background: rgba(0,0,0,0.6) !important;
                }

                .mm-cb-wrap { display: flex; align-items: center; gap: 12px; cursor: pointer; margin-bottom: 12px; }
                .mm-cb-wrap input { display: none; }
                .mm-cb-box {
                    width: 18px; height: 18px;
                    background: rgba(0,0,0,0.4);
                    border: 1px solid var(--mm-border);
                    border-radius: 4px;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                }
                .mm-cb-wrap:hover .mm-cb-box { border-color: var(--mm-theme); box-shadow: 0 0 8px var(--mm-theme); transform: scale(1.08); }
                .mm-cb-wrap input:checked + .mm-cb-box {
                    background: var(--mm-theme);
                    border-color: var(--mm-theme);
                    box-shadow: 0 0 12px var(--mm-theme);
                    animation: cb-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .mm-cb-box::after { content: ''; width: 5px; height: 9px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg) scale(0); transition: transform 0.2s ease; opacity: 0; font-size: 0; }
                .mm-cb-wrap input:checked + .mm-cb-box::after { content: ''; transform: rotate(45deg) scale(1); opacity: 1; }

                .mm-dropdown-container { margin-bottom: 14px; position: relative; font-family: 'Inter', Arial, sans-serif; }
                .mm-dropdown-trigger {
                    background: var(--mm-surface);
                    border: 1px solid var(--mm-border);
                    color: #fff; padding: 10px 14px; border-radius: 8px;
                    font-size: 13px; font-weight: 600; cursor: pointer;
                    display: flex; justify-content: space-between; align-items: center;
                    width: 100%; transition: all 0.2s ease;
                }
                .mm-dropdown-trigger:hover { border-color: var(--mm-theme); background: rgba(255,255,255,0.05); }
                
                .mm-dropdown-menu {
                    position: absolute; top: calc(100% + 8px); left: 0; width: 100%;
                    background: rgba(15, 15, 15, 0.95);
                    backdrop-filter: blur(16px);
                    border: 1px solid var(--mm-border); border-radius: 8px;
                    max-height: 220px; overflow-y: auto; z-index: 10000;
                    display: none; opacity: 0; transform: translateY(-10px);
                    box-shadow: 0 12px 32px rgba(0,0,0,0.8);
                    transition: opacity 0.2s ease, transform 0.2s ease;
                }
                .mm-dropdown-menu.open { display: block; opacity: 1; transform: translateY(0); animation: none; }
                
                .mm-dropdown-menu::-webkit-scrollbar { width: 4px; }
                .mm-dropdown-menu::-webkit-scrollbar-track { background: transparent; }
                .mm-dropdown-menu::-webkit-scrollbar-thumb { background: var(--mm-theme); border-radius: 10px; }

                .mm-dropdown-item {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05);
                    gap: 12px; transition: background 0.2s ease;
                }
                .mm-dropdown-item:hover { background: rgba(255,255,255,0.08); padding-left: 16px; }
                .mm-dropdown-item:last-child { border-bottom: none; }
                
                .mm-dd-title { font-size: 12px; color: #fff; font-weight: 600; flex: 2; }
                .mm-dd-id {
                    font-size: 10px; color: #888; background: rgba(0,0,0,0.5);
                    padding: 3px 6px; border-radius: 4px; font-family: monospace; border: 1px solid var(--mm-border);
                }
                .mm-dd-join-btn {
                    padding: 5px 10px; background: var(--mm-theme); border: none; color: #fff;
                    font-size: 11px; font-weight: 800; border-radius: 4px; cursor: pointer;
                    transition: transform 0.1s ease, filter 0.1s ease, box-shadow 0.2s ease;
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                }
                .mm-dd-join-btn:hover { transform: scale(1.08); filter: brightness(1.2); box-shadow: 0 0 15px var(--mm-theme); }
                .mm-dd-join-btn:active { transform: scale(0.95); }

                .mm-footer {
                    background: rgba(0, 0, 0, 0.4) !important;
                    border-top: 1px solid var(--mm-border);
                    padding: 10px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-family: 'Inter', Arial, sans-serif;
                }
                .mm-status-label { font-size: 10px; color: #7a7a8c; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; }
                .mm-status-wrapper { display: flex; align-items: center; gap: 8px; }
                .mm-status-text { font-size: 11px; font-weight: 800; letter-spacing: 0.5px; }
                .mm-status-text.connected { color: #00ff88; text-shadow: 0 0 8px rgba(0,255,136,0.5); }
                .mm-status-text.disconnected { color: #ff2a5f; text-shadow: 0 0 8px rgba(255,42,95,0.5); }
                
                .mm-status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
                .mm-status-dot.connected { background: #00ff88; box-shadow: 0 0 10px #00ff88, 0 0 20px #00ff88; }
                .mm-status-dot.disconnected { background: #ff2a5f; box-shadow: 0 0 10px #ff2a5f, 0 0 20px #ff2a5f; }
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

                // 🚨 FORCE CENTER SPAWN FOR MOBILE VIEWPORT MATH
                const menuWidth = parseInt(opts.width || '340', 10);
                const centerX = Math.max(10, (window.innerWidth / 2) - (menuWidth / 2));
                const centerY = Math.max(10, (window.innerHeight / 2) - 250); // rough half height offset

                box.style.cssText = `
                    width: ${opts.width || '340px'};
                    top: ${centerY}px;
                    left: ${centerX}px;
                `;

                const header = document.createElement('div');
                header.className = 'mm-header';
                header.innerHTML = `<span class="mm-title">${title}</span>`;

                const minBtn = document.createElement('button');
                minBtn.className = 'mm-btn-min';
                minBtn.textContent = '_';
                let minimised = false;
                minBtn.onclick = () => {
                    minimised = !minimised;
                    inner.style.display = minimised ? 'none' : '';
                };

                const closeBtn = document.createElement('button');
                closeBtn.className = 'mm-btn-close';
                closeBtn.textContent = '✕';
                closeBtn.onclick = () => box.remove();

                header.appendChild(minBtn);
                header.appendChild(closeBtn);

                const inner = document.createElement('div');
                const tabBar = document.createElement('div');
                tabBar.className = 'mm-tabs';
                const tabContent = document.createElement('div');

                inner.appendChild(tabBar);
                inner.appendChild(tabContent);
                box.appendChild(header);
                box.appendChild(inner);

                const footer = document.createElement('div');
                footer.className = 'mm-footer';
                footer.innerHTML = `
                    <span class="mm-status-label">Terminal Status</span>
                    <div class="mm-status-wrapper">
                        <span id="mm-dot" class="mm-status-dot disconnected"></span>
                        <span id="mm-status" class="mm-status-text disconnected">NOT INJECTED</span>
                    </div>
                `;
                box.appendChild(footer);
                document.body.appendChild(box);

                // --- Advanced Kinetic Dragging & Tilt Engine ---
                let drag = 