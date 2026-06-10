// ==UserScript==
// @name         Club Penguin Menu
// @namespace    http://tampermonkey.net/
// @version      1.0
// @match        https://*.cplegacy.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // localstorage wrapper
    const Config = {
        get(key, defaultVal) {
            return GM_getValue(key, defaultVal);
        },
        set(key, val) {
            GM_setValue(key, val);
        }
    };

    // send raw packet to socket
    const sendPacket = (command, data = {}) => {
        if (!unsafeWindow._MM_SOCKETS || unsafeWindow._MM_SOCKETS.length === 0) return;
        const packet = {
            type: 2,
            data: ['message', command, data],
            options: { compress: true },
            nsp: '/'
        };
        const encoded = msgpack.encode(packet);
        unsafeWindow._MM_sendRaw(encoded);
    };

    // ui sounds
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

    // check if blizzard server
    function getServerString(serverUrl) {
        if (serverUrl && serverUrl.includes("blizzard")) {
            return "Blizzard";
        } else {
            return "Unknown";
        }
    }

    // loop to check if we are connected to the game
    function runStatusCheckLoop() {
        const statusText = document.getElementById('mm-status');
        const statusDot = document.getElementById('mm-dot');
        const nickDisplay = document.getElementById("mm-player-nick-display");
        const idDisplay = document.getElementById('mm-player-id-display');
        const functionalPanel = document.getElementById('mm-functional-panel');

        const isSocketActive = !!(unsafeWindow._MM_SOCKETS && unsafeWindow._MM_SOCKETS.length > 0);

        if (statusText && statusDot && idDisplay) {
            if (isSocketActive) {
                var serverUrl = unsafeWindow._MM_SOCKETS[0].url;

                statusText.className = 'mm-status-text connected';
                statusText.textContent = 'Connected - ' + getServerString(serverUrl);
                statusDot.className = 'mm-status-dot connected';

                // unlock ui
                if (functionalPanel) functionalPanel.classList.remove('mm-menu-locked');

                try {
                    if (unsafeWindow.FlashBridge && unsafeWindow.FlashBridge.shell) {
                        const pID = unsafeWindow.FlashBridge.shell.getMyPlayerId();
                        const pNICK = unsafeWindow.FlashBridge.shell.getMyPlayerNickname();
                        idDisplay.textContent = pID || "0";
                        nickDisplay.textContent = pNICK || "Not logged in.";
                    } else {
                        idDisplay.textContent = "0";
                        nickDisplay.textContent = "Not logged in.";
                    }
                } catch (e) {
                    idDisplay.textContent = "0";
                    nickDisplay.textContent = "Not logged in.";
                }
            } else {
                statusText.className = 'mm-status-text disconnected';
                statusText.textContent = 'Not connected';
                statusDot.className = 'mm-status-dot disconnected';

                // lock ui if offline
                if (functionalPanel) functionalPanel.classList.add('mm-menu-locked');

                idDisplay.textContent = "0";
                nickDisplay.textContent = "Not logged in.";
            }
        }
        setTimeout(runStatusCheckLoop, 1000);
    }

    function initMenu() {
        const ModMenu = (() => {
            const style = `
                :root { 
                    --mm-theme: ${Config.get('theme_color', '#bf0000')};
                    --mm-title: ${Config.get('title_color', '#ffffff')};
                    --mm-bg: #141414;
                    --mm-bg-sec: #1c1c1c;
                    --mm-border: #2d2d2d;
                    --mm-border-light: #3a3a3a;
                    --mm-text: #cccccc;
                    --mm-text-mut: #888888;
                }
                
                .mm-menu-locked {
                    pointer-events: none !important;
                    opacity: 0.35 !important;
                    filter: grayscale(70%) brightness(0.7) !important;
                    cursor: not-allowed !important;
                    transition: all 0.3s !important;
                }
                
                .mm-box {
                    position: fixed; user-select: none;
                    background: var(--mm-bg) !important;
                    border: 1px solid var(--mm-border) !important;
                    box-shadow: 0 0 10px rgba(0,0,0,0.8), inset 0 0 0 1px #222 !important;
                    border-radius: 4px; min-width: 300px; z-index: 999999;
                    font-family: "Segoe UI", Tahoma, sans-serif !important;
                    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    max-height: 800px; overflow: hidden;
                }
                
                .mm-header {
                    background: var(--mm-bg-sec) !important;
                    border-bottom: 1px solid var(--mm-border);
                    border-top: 2px solid var(--mm-theme);
                    padding: 0 10px; height: 28px;
                    display: flex; align-items: center; cursor: move; gap: 6px;
                }
                
                .mm-title { 
                    flex: 1; color: var(--mm-title); font-size: 11px; 
                    font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; 
                }
                
                .mm-btn-close, .mm-btn-min {
                    width: 14px; height: 14px; border-radius: 2px; border: none; cursor: pointer;
                    font-size: 9px; display: flex; align-items: center; justify-content: center; 
                    color: #fff; background: var(--mm-border-light);
                    transition: background 0.15s ease;
                }
                .mm-btn-close:hover { background: #ff4444; }
                .mm-btn-min:hover { background: #ffcc00; }
                
                .mm-tabs { 
                    display: flex; border-bottom: 1px solid var(--mm-border); 
                    background: var(--mm-bg); padding: 0 6px; 
                }
                .mm-tab {
                    padding: 6px 12px; font-size: 10px; color: var(--mm-text-mut); cursor: pointer;
                    border: 1px solid transparent; border-bottom: none; margin-bottom: -1px; 
                    text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;
                    transition: color 0.15s ease;
                }
                .mm-tab:hover { color: #fff; }
                .mm-tab.active {
                    color: var(--mm-theme); background: var(--mm-bg-sec);
                    border-color: var(--mm-border); border-top: 2px solid var(--mm-theme);
                }
                
                .mm-body { 
                    padding: 16px 12px 12px 12px; opacity: 0; transform: translateY(4px); 
                    transition: opacity 0.25s ease, transform 0.25s ease; display: none; 
                }
                .mm-body.active { display: block; opacity: 1; transform: translateY(0); }
                
                .mm-section {
                    margin-bottom: 16px; padding: 12px 10px 6px 10px;
                    border: 1px solid var(--mm-border); border-radius: 2px; 
                    background: transparent; position: relative;
                }
                .mm-section-title {
                    font-size: 10px; font-weight: bold; color: var(--mm-text); 
                    text-transform: uppercase; letter-spacing: 0.5px;
                    position: absolute; top: -7px; left: 8px; 
                    background: var(--mm-bg); padding: 0 4px;
                }
                .mm-subtitle { font-size: 9px; color: var(--mm-text-mut); margin-bottom: 10px; margin-top: -2px; }
                
                .mm-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
                .mm-label { font-size: 11px; color: var(--mm-text); flex: 1; }
                
                .mm-btn-el {
                    padding: 6px 10px; background: #1e1e1e; border: 1px solid var(--mm-border-light); 
                    color: var(--mm-text); font-size: 10px; cursor: pointer; border-radius: 2px; 
                    width: 100%; text-align: center; text-transform: uppercase; 
                    margin-bottom: 6px; display: block; box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                    transition: all 0.1s ease;
                    text-shadow: none !important;
                }
                .mm-btn-el:hover { background: #252526; border-color: var(--mm-text-mut); color: #fff; }
                .mm-btn-el:active { background: #171717; transform: translateY(1px); }
                .mm-btn-el.green { color: #00ff88; border-color: rgba(0,255,136,0.3); }
                .mm-btn-el.blue { color: #33b5e5; border-color: rgba(51,181,229,0.3); }
                .mm-btn-el.red { color: #ff4444; border-color: rgba(255,68,68,0.3); }
                .mm-btn-el.yellow { color: #ffcc00; border-color: rgba(255,204,0,0.3); }
                
                .mm-input-el {
                    background: #111 !important; border: 1px solid var(--mm-border-light) !important;
                    color: #fff !important; font-size: 11px !important; border-radius: 2px !important;
                    outline: none !important; font-family: "Segoe UI", Tahoma, sans-serif !important;
                    text-align: center !important; padding: 4px 6px !important; transition: border 0.2s ease !important;
                }
                .mm-input-el:focus { border-color: var(--mm-theme) !important; background: #141414 !important; }
                
                .mm-cb-wrap { display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px; }
                .mm-cb-wrap input { display: none; }
                .mm-cb-box {
                    width: 12px; height: 12px; background: #111; border: 1px solid var(--mm-border-light);
                    border-radius: 2px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                    transition: all 0.1s; position: relative;
                }
                .mm-cb-wrap:hover .mm-cb-box { border-color: var(--mm-text-mut); }
                .mm-cb-wrap input:checked + .mm-cb-box { border-color: var(--mm-theme); }
                
                .mm-cb-box::after { 
                    content: ''; display: none; width: 6px; height: 6px; 
                    background: var(--mm-theme); border-radius: 1px; 
                }
                .mm-cb-wrap input:checked + .mm-cb-box::after { display: block; }
                
                .mm-footer { 
                    background: var(--mm-bg-sec) !important; border-top: 1px solid var(--mm-border); 
                    padding: 5px 10px; display: flex; justify-content: space-between; align-items: center; 
                }
                .mm-status-label { font-size: 9px; color: var(--mm-text-mut); text-transform: uppercase; font-weight: bold; }
                .mm-status-text { font-size: 9px; font-weight: bold; text-transform: uppercase; }
                .mm-status-text.connected { color: #00ff88; }
                .mm-status-text.disconnected { color: #ff4444; }
                .mm-status-dot { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }
                .mm-status-dot.connected { background: #00ff88; box-shadow: 0 0 4px #00ff88; }
                .mm-status-dot.disconnected { background: #ff4444; box-shadow: 0 0 4px #ff4444; }

                .mm-dropdown-container { margin-bottom: 10px; position: relative; }
                .mm-dropdown-trigger {
                    background: #1e1e1e; border: 1px solid var(--mm-border-light); color: var(--mm-text);
                    padding: 5px 10px; border-radius: 2px; font-size: 10px; cursor: pointer;
                    display: flex; justify-content: space-between; align-items: center; width: 100%; 
                    transition: all 0.15s ease;
                    text-shadow: none !important;
                }
                .mm-dropdown-trigger:hover { border-color: var(--mm-text-mut); color: #fff; background: #252526; }
                .mm-dropdown-menu {
                    position: absolute; top: calc(100% + 2px); left: 0; width: 100%;
                    background: var(--mm-bg-sec); border: 1px solid var(--mm-border); border-radius: 2px;
                    max-height: 200px; overflow-y: auto; z-index: 10000; display: none;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.8);
                }
                .mm-box:has(.mm-dropdown-menu.open) {
                    overflow: visible !important;
                    max-height: none !important; 
                }
                .mm-dropdown-menu.open { display: block; animation: dd-slide 0.1s ease-out; }
                .mm-dropdown-item {
                    display: flex; align-items: center; justify-content: space-between; padding: 4px 8px;
                    border-bottom: 1px solid var(--mm-border); gap: 10px; font-size: 11px;
                }
                .mm-dropdown-item:hover { background: #252526; }
                .mm-dropdown-item:last-child { border-bottom: none; }
                .mm-dd-title { color: var(--mm-theme); font-weight: bold; font-size: 10px; flex: 2; text-transform: uppercase; }
                .mm-dd-id { 
                    font-size: 9px; color: var(--mm-text-mut); font-family: Consolas, monospace; 
                    background: #111; padding: 1px 4px; border: 1px solid #222; border-radius: 2px; 
                }
                .mm-dd-join-btn {
                    padding: 3px 6px; background: #1e1e1e; border: 1px solid var(--mm-border-light);
                    color: var(--mm-title); font-size: 9px; font-weight: bold; border-radius: 2px; 
                    cursor: pointer; text-transform: uppercase;
                    text-shadow: none !important;
                }
                .mm-dd-join-btn:hover { border-color: var(--mm-theme); color: var(--mm-theme); background: #111; }

                .mm-dropdown-menu::-webkit-scrollbar { width: 4px; }
                .mm-dropdown-menu::-webkit-scrollbar-track { background: var(--mm-bg); }
                .mm-dropdown-menu::-webkit-scrollbar-thumb { background: var(--mm-theme); border-radius: 2px; }
                
                @keyframes dd-slide {
                    0% { opacity: 0; transform: translateY(-2px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .mm-player-id {
                    font-size: 9px; color: var(--mm-text-mut); margin-right: 10px; font-family: Consolas, monospace;
                    border: 1px solid var(--mm-border); padding: 1px 4px; background: #111;
                }

                .mm-box {
                    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                                width 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                                height 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                                border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                                background 0.3s ease, 
                                box-shadow 0.3s ease !important;
                }

                .mm-box.mm-minimized {
                    min-width: 52px !important; width: 52px !important; height: 52px !important; max-height: 52px !important;
                    border-radius: 50% !important; overflow: hidden !important; background: var(--mm-theme) !important;
                    box-shadow: 0 0 20px var(--mm-theme) !important; cursor: pointer !important;
                }

                .mm-box.mm-minimized .mm-header, 
                .mm-box.mm-minimized .mm-tabs, 
                .mm-box.mm-minimized #mm-functional-panel, 
                .mm-box.mm-minimized .mm-footer {
                    display: none !important;
                }

                .mm-box.mm-minimized::after {
                    content: 'X'; color: var(--mm-title) !important; position: absolute;
                    top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px;
                    animation: mm-pulse 2s infinite ease-in-out;
                }

                @keyframes mm-pulse {
                    0%, 100% { transform: translate(-50%, -50%) scale(1); }
                    50% { transform: translate(-50%, -50%) scale(1.1); }
                }

                .mm-toast-container {
                    position: fixed; bottom: 20px; right: 20px; z-index: 1000000;
                    display: flex; flex-direction: column; gap: 10px; pointer-events: none;
                }
                .mm-toast {
                    background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                    border-left: 4px solid var(--mm-theme); border-top: 1px solid rgba(255,255,255,0.05);
                    color: #fff; padding: 12px 18px; font-family: Arial, sans-serif; font-size: 12px;
                    font-weight: bold; border-radius: 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                    transform: translateX(125%); transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease;
                    opacity: 0; display: flex; align-items: center; gap: 8px;
                }
                .mm-toast.show { transform: translateX(0); opacity: 1; }

                .mm-timer-wrap {
                    max-height: 0; opacity: 0; overflow: hidden;
                    transition: max-height 0.4s ease, opacity 0.4s ease, padding 0.4s ease;
                    background: #111; border-radius: 0 0 2px 2px; 
                    border: 1px solid transparent; border-top: none;
                    border-radius: 3px;
                    text-align: center; position: relative; z-index: 1;
                }
                .mm-timer-wrap.active {
                    max-height: 40px; opacity: 1; padding: 6px;
                    border-color: var(--mm-theme);
                }
                .mm-timer-text { 
                    font-family: Consolas, monospace; font-size: 11px; 
                    color: #ffcc00; font-weight: bold; text-transform: uppercase;
                }
                .mm-listview {
                    background: #111 !important;
                    border: 1px solid var(--mm-border) !important;
                    border-radius: 2px;
                    max-height: 180px;
                    overflow-y: auto;
                    margin-top: 5px;
                    margin-bottom: 10px;
                }
                .mm-list-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 6px 10px;
                    border-bottom: 1px solid #1c1c1c;
                    font-size: 11px;
                    color: var(--mm-text);
                }
                .mm-list-item:last-child { border-bottom: none; }
                .mm-list-name { font-weight: bold; color: #fff; }
                .mm-list-id { font-family: Consolas, monospace; color: var(--mm-text-mut); font-size: 9px; }
                /* --- SNIFFER TERMINAL SHIT --- */
                .mm-sniffer-ui { position: fixed; top: 50px; left: 50px; width: 450px; height: 500px; background: var(--mm-bg); border: 1px solid var(--mm-border); z-index: 9999999; display: none; flex-direction: column; box-shadow: 0 0 20px rgba(0,0,0,0.9); border-radius: 4px; overflow: hidden; }
                .mm-sniffer-ui.open { display: flex; }
                .mm-sniffer-head { background: var(--mm-bg-sec); border-bottom: 1px solid var(--mm-border); padding: 8px 10px; color: var(--mm-title); font-size: 11px; font-weight: bold; cursor: move; display: flex; justify-content: space-between; border-top: 2px solid #8a2be2; }
                .mm-sniffer-close { cursor: pointer; color: #ff4444; background: none; border: none; font-weight: bold; }
                .mm-sniffer-tools { padding: 6px; background: #111; border-bottom: 1px solid #222; display: flex; gap: 8px; align-items: center; }
                .mm-sniffer-tools button { background: #1e1e1e; color: #ccc; border: 1px solid #333; padding: 4px 10px; font-size: 9px; cursor: pointer; border-radius: 2px; text-transform: uppercase; font-weight: bold; }
                .mm-sniffer-tools button:hover { background: #333; color: #fff; }
                .mm-sniffer-list { flex: 1; overflow-y: auto; padding: 5px; background: #0a0a0a; }
                .mm-sniffer-item { background: #141414; border: 1px solid #1c1c1c; margin-bottom: 4px; border-radius: 2px; }
                .mm-sniffer-header { padding: 6px 8px; font-size: 10px; font-weight: bold; cursor: pointer; color: #ccc; display: flex; gap: 10px; align-items: center; font-family: Consolas, monospace; }
                .mm-sniffer-header:hover { background: #1c1c1c; color: #fff; }
                .mm-sniffer-header.IN { border-left: 3px solid #00ff88; }
                .mm-sniffer-header.OUT { border-left: 3px solid #33b5e5; }
                .mm-sniffer-time { color: var(--mm-text-mut); font-size: 8px; min-width: 50px; }
                .mm-sniffer-body { display: none; padding: 10px; margin: 0; background: #050505; color: #00ff88; font-family: Consolas, monospace; font-size: 10px; overflow-x: auto; max-height: 300px; overflow-y: auto; border-top: 1px solid #1c1c1c; white-space: pre-wrap; }
                .mm-sniffer-body.open { display: block; }
            `;

            // pop up notification function
            function showNotification(msg) {
                let container = document.getElementById('mm-toast-box');
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'mm-toast-box';
                    container.className = 'mm-toast-container';
                    document.body.appendChild(container);
                }
                const toast = document.createElement('div');
                toast.className = 'mm-toast';
                toast.innerHTML = `<span>⚙️</span> <span>${msg}</span>`;
                container.appendChild(toast);

                setTimeout(() => toast.classList.add('show'), 50);

                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 350);
                }, 3500);
            }

            // append css to head
            function inject() {
                let s = document.getElementById('mm-style');
                if (!s) {
                    s = document.createElement('style');
                    s.id = 'mm-style';
                    document.head.appendChild(s);
                }
                s.textContent = style;
            }

            // create main window
            function Window(title, opts = {}) {
                inject();
                const box = document.createElement('div');
                box.className = 'mm-box';

                // restore position if saved
                const savedX = Config.get('menu_x', null);
                const savedY = Config.get('menu_y', '20px');
                box.style.cssText = `
                    width: ${opts.width || '440px'};
                    top: ${savedY};
                    left: ${savedX ? savedX : (opts.x === 'right' ? 'auto' : (opts.x || '20px'))};
                    right: ${savedX ? 'auto' : (opts.x === 'right' ? '20px' : 'auto')};
                `;

                const header = document.createElement('div');
                header.className = 'mm-header';
                header.innerHTML = `<span class="mm-title">${title}</span>`;

                let minimised = false;
                let restoreX = 0, restoreY = 0;

                const minBtn = document.createElement('button');
                minBtn.className = 'mm-btn-min';
                minBtn.textContent = '_';

                function toggleMinimize() {
                    minimised = !minimised;
                    if (minimised) {
                        restoreX = currentX;
                        restoreY = currentY;
                        box.classList.add('mm-minimized');
                        showNotification("Terminal minimized to background tray.");
                    } else {
                        box.classList.remove('mm-minimized');
                        targetX = restoreX;
                        targetY = restoreY;
                        showNotification("Terminal restored to active view.");
                    }
                }

                minBtn.onclick = (e) => {
                    e.stopPropagation();
                    toggleMinimize();
                };

                box.onclick = () => {
                    if (minimised) toggleMinimize();
                };

                const closeBtn = document.createElement('button');
                closeBtn.className = 'mm-btn-close';
                closeBtn.textContent = '✕';
                closeBtn.onclick = () => box.remove();

                header.appendChild(minBtn);
                header.appendChild(closeBtn);

                // locked panel container
                const inner = document.createElement('div');
                inner.id = 'mm-functional-panel';
                inner.className = 'mm-menu-locked'; 

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
                    <div style="display: flex; align-items: center;">
                        <span class="mm-status-label" style="margin-right: 5px;">User:</span>
                        <span id="mm-player-nick-display" class="mm-player-id">Not logged in.</span>
                        <span class="mm-status-label" style="margin-right: 5px;">ID:</span>
                        <span id="mm-player-id-display" class="mm-player-id">0</span>
                    </div>
                    <div class="mm-status-wrapper" style="display: flex; align-items: center;">
                        <span id="mm-dot" class="mm-status-dot disconnected" style="margin-right: 5px;"></span>
                        <span id="mm-status" class="mm-status-text disconnected">Not connected</span>
                    </div>
                `;
                box.appendChild(footer);
                document.body.appendChild(box);

                // drag logic
                let drag = false;
                let ox = 0, oy = 0;
                let mouseX = 0, mouseY = 0;
                let currentX = 0, currentY = 0;
                let targetX = 0, targetY = 0;
                let vx = 0, vy = 0;
                let lastMouseX = 0, lastMouseY = 0;
                const lerpSpeed = 0.15;
                const friction = 0.92;

                const rect = box.getBoundingClientRect();
                currentX = targetX = rect.left;
                currentY = targetY = rect.top;

                header.addEventListener('mousedown', e => {
                    if (minimised) return;
                    drag = true;
                    ox = e.clientX - box.getBoundingClientRect().left;
                    oy = e.clientY - box.getBoundingClientRect().top;
                    mouseX = lastMouseX = e.clientX;
                    mouseY = lastMouseY = e.clientY;
                    targetX = mouseX - ox;
                    targetY = mouseY - oy;
                    vx = 0; vy = 0;
                    box.style.right = 'auto';
                    e.preventDefault();
                });

                document.addEventListener('mousemove', e => {
                    if (!drag) return;
                    mouseX = e.clientX;
                    mouseY = e.clientY;
                    targetX = mouseX - ox;
                    targetY = mouseY - oy;
                });

                document.addEventListener('mouseup', () => { drag = false; });

                let currentTilt = 0;
                
                // physics engine for ui
                function updatePhysicsLoop() {
                    let targetTilt = 0;
                    const boxRect = box.getBoundingClientRect();
                    const boxWidth = boxRect.width;
                    const boxHeight = boxRect.height;
                    const screenWidth = window.innerWidth;
                    const screenHeight = window.innerHeight;

                    if (minimised) {
                        targetX = 20;
                        targetY = screenHeight - 72;
                        currentX += (targetX - currentX) * 0.12;
                        currentY += (targetY - currentY) * 0.12;
                        vx = 0; vy = 0;
                        targetTilt = 0;
                    } 
                    else if (drag) {
                        const currentMouseX = mouseX;
                        vx = currentMouseX - lastMouseX;
                        vy = mouseY - lastMouseY;
                        lastMouseX = currentMouseX;
                        lastMouseY = mouseY;

                        currentX += (targetX - currentX) * lerpSpeed;
                        currentY += (targetY - currentY) * lerpSpeed;
                        targetTilt = Math.max(-12, Math.min(12, vx * 0.4));
                        
                        Config.set('win_x', currentX);
                        Config.set('win_y', currentY);
                    } 
                    else {
                        vx *= friction;
                        vy *= friction;
                        if (Math.abs(vx) < 0.05) vx = 0;
                        if (Math.abs(vy) < 0.05) vy = 0;

                        currentX += vx;
                        currentY += vy;
                        targetTilt = Math.max(-12, Math.min(12, vx * 0.4));

                        if (vx === 0 && vy === 0 && box.style.left !== currentX + 'px') {
                            Config.set('menu_x', box.style.left);
                            Config.set('menu_y', box.style.top);
                        }
                    }

                    // bounds check
                    if (!minimised) {
                        const elasticity = 0.6;
                        if (currentX < 0) { currentX = 0; vx = -vx * elasticity; } 
                        else if (currentX + boxWidth > screenWidth) { currentX = screenWidth - boxWidth; vx = -vx * elasticity; }
                        if (currentY < 0) { currentY = 0; vy = -vy * elasticity; } 
                        else if (currentY + boxHeight > screenHeight) { currentY = screenHeight - boxHeight; vy = -vy * elasticity; }
                    }

                    currentTilt += (targetTilt - currentTilt) * 0.10;
                    box.style.left = currentX + 'px';
                    box.style.top = currentY + 'px';
                    box.style.transform = `rotate(${currentTilt}deg)`;

                    requestAnimationFrame(updatePhysicsLoop);
                }

                requestAnimationFrame(updatePhysicsLoop);
                
                // emergency menu reset
                document.addEventListener('keydown', (e) => {
                    if (document.activeElement && (
                        document.activeElement.tagName === 'INPUT' ||
                        document.activeElement.tagName === 'TEXTAREA' ||
                        document.activeElement.isContentEditable
                    )) {
                        return;
                    }

                    const isXKey = e.keyCode === 88 || e.key.toLowerCase() === 'x';

                    if (e.ctrlKey && e.shiftKey && isXKey) {
                        e.preventDefault();
                        e.stopPropagation();

                        if (box) {
                            const centerX = Math.max(50, (window.innerWidth / 2) - 140);
                            const centerY = Math.max(50, (window.innerHeight / 2) - 200);

                            box.style.left = centerX + 'px';
                            box.style.top = centerY + 'px';
                            box.style.transform = 'none';

                            currentX = targetX = centerX;
                            currentY = targetY = centerY;
                            vx = vy = currentTilt = 0;

                            Config.set('menu_x', centerX + 'px');
                            Config.set('menu_y', centerY + 'px');

                            unsafeWindow._MM_Log("🎯 HARDWARE RECOVERY: Menu snapped back to center screen!");
                        }
                    }
                });

                const tabs = [];

                function addTab(name) {
                    const tabEl = document.createElement('div');
                    tabEl.className = 'mm-tab';
                    tabEl.textContent = name;

                    const bodyEl = document.createElement('div');
                    bodyEl.className = 'mm-body';

                    tabEl.onclick = () => {
                        const oldHeight = box.getBoundingClientRect().height;
                        box.style.maxHeight = oldHeight + 'px';

                        tabs.forEach(t => t.el.classList.remove('active'));
                        tabEl.classList.add('active');

                        bodyEl.style.display = 'block';
                        bodyEl.style.position = 'absolute';
                        bodyEl.style.visibility = 'hidden';

                        box.style.maxHeight = 'none';

                        const headerHeight = header.getBoundingClientRect().height;
                        const tabsBarHeight = tabBar.getBoundingClientRect().height;
                        const padding = 28;
                        const newBodyHeight = bodyEl.scrollHeight + padding;
                        const targetHeight = headerHeight + tabsBarHeight + newBodyHeight;

                        bodyEl.style.display = '';
                        bodyEl.style.position = '';
                        bodyEl.style.visibility = '';

                        tabs.forEach(t => t.body.classList.remove('active'));
                        bodyEl.classList.add('active');

                        box.style.maxHeight = oldHeight + 'px';
                        void box.offsetHeight;

                        box.style.maxHeight = targetHeight + 'px';

                        setTimeout(() => {
                            box.style.maxHeight = '';
                        }, 300);
                    };

                    tabBar.appendChild(tabEl);
                    tabContent.appendChild(bodyEl);
                    tabs.push({ el: tabEl, body: bodyEl });

                    if (tabs.length === 1) { tabEl.classList.add('active'); bodyEl.classList.add('active'); }

                    return Tab(bodyEl);
                }

                return { addTab };
            }

            // ui element builders
            function Tab(container) {
                function section(title, subtitle, pic=null) {
                    const sec = document.createElement('div');
                    sec.className = 'mm-section';
                    sec.innerHTML = `<div class="mm-section-title">${title}</div>${subtitle ? `<div class="mm-subtitle">${subtitle}</div>` : ''}`;
                    container.appendChild(sec);
                    return Section(sec);
                }
                return { section };
            }

            function Section(sec) {
                function listview(id) {
                    const lv = document.createElement('div');
                    lv.id = id;
                    lv.className = 'mm-listview';
                    sec.appendChild(lv);
                    return { button, checkbox, input, dropdown, listview };
                }

                function button(label, color, onClick) {
                    const btn = document.createElement('button');
                    btn.className = `mm-btn-el${color ? ' ' + color : ''}`;
                    btn.textContent = label;
                    
                    btn.onclick = (e) => {
                        if (typeof AudioFX !== 'undefined' && AudioFX.playClick) AudioFX.playClick();
                        if (onClick) onClick(e);
                    };
                    
                    sec.appendChild(btn);
                    return { button, checkbox, input, dropdown, listview };
                }
                function checkbox(label, configKey, defaultVal, onChange) {
                    const wrap = document.createElement('label');
                    wrap.className = 'mm-cb-wrap';
                    const inp = document.createElement('input');
                    inp.type = 'checkbox';

                    const savedState = Config.get(configKey, defaultVal);
                    inp.checked = savedState;

                    const box = document.createElement('span');
                    box.className = 'mm-cb-box';
                    const lbl = document.createElement('span');
                    lbl.className = 'mm-label';
                    lbl.textContent = label;
                    wrap.appendChild(inp);
                    wrap.appendChild(box);
                    wrap.appendChild(lbl);

                    inp.onchange = () => {
                        Config.set(configKey, inp.checked);
                        if (typeof AudioFX !== 'undefined' && AudioFX.playToggle) AudioFX.playToggle(inp.checked);
                        if (onChange) onChange(inp.checked);
                    };
                    
                    if (savedState && onChange) {
                        onChange(savedState);
                    }

                    sec.appendChild(wrap);
                    return { button, checkbox, input, dropdown, listview };
                }
                function input(label, configKey, defaultVal, placeholder, onChange, inputType = 'text') {
                    const row = document.createElement('div');
                    row.className = 'mm-row';
                    row.innerHTML = `<span class="mm-label">${label}</span>`;

                    const inp = document.createElement('input');
                    inp.className = 'mm-input-el';
                    inp.type = inputType;
                    inp.placeholder = placeholder || '';

                    if (inputType === 'color') {
                        inp.style.cssText = 'width: 40px; height: 26px; border: 1px solid #333; background: none; cursor: pointer; padding: 0;';
                    } else {
                        inp.style.width = '120px';
                    }

                    inp.value = Config.get(configKey, defaultVal);

                    inp.oninput = () => {
                        Config.set(configKey, inp.value);
                        if (onChange) onChange(inp.value);
                    };

                    row.appendChild(inp);
                    sec.appendChild(row);
                    return { button, checkbox, input, dropdown, listview };
                }
                function dropdown(label, dataArray, actionBtnLabel, secLabel, onSelect) {
                    const container = document.createElement('div');
                    container.className = 'mm-dropdown-container';

                    const trigger = document.createElement('button');
                    trigger.className = 'mm-dropdown-trigger';
                    trigger.innerHTML = `<span>${label}</span> <span class="mm-dd-arrow">▼</span>`;
                    
                    const menu = document.createElement('div');
                    menu.className = 'mm-dropdown-menu';

                    const timerWrap = document.createElement('div');
                    timerWrap.className = 'mm-timer-wrap';
                    timerWrap.innerHTML = `<span class="mm-timer-text">WAITING...</span>`;

                    const closeOnOutsideClick = (e) => {
                        if (!container.contains(e.target)) {
                            menu.classList.remove('open');
                            document.removeEventListener('click', closeOnOutsideClick);
                        }
                    };

                    trigger.onclick = (e) => {
                        e.stopPropagation();
                        const isOpen = menu.classList.contains('open');
                        document.querySelectorAll('.mm-dropdown-menu').forEach(m => m.classList.remove('open'));
                        if (!isOpen) {
                            menu.classList.add('open');
                            document.addEventListener('click', closeOnOutsideClick);
                        }
                    };

                    dataArray.forEach(itemData => {
                        const item = document.createElement('div');
                        item.className = 'mm-dropdown-item';
                        item.innerHTML = `
                            <span class="mm-dd-title">${itemData.data1}</span>
                            <span class="mm-dd-id">${secLabel}: ${itemData.data2}</span>
                        `;

                        const actionBtn = document.createElement('button');
                        actionBtn.className = 'mm-dd-join-btn';
                        actionBtn.textContent = actionBtnLabel;
                        
                        actionBtn.onclick = (e) => {
                            e.stopPropagation();
                            if (typeof AudioFX !== 'undefined' && AudioFX.playClick) AudioFX.playClick();
                            if (typeof onSelect === 'function') {
                                onSelect(itemData.data1, itemData.data2, timerWrap); 
                            }
                            menu.classList.remove('open');
                        };

                        item.appendChild(actionBtn);
                        menu.appendChild(item);
                    });

                    container.appendChild(trigger);
                    container.appendChild(menu);
                    container.appendChild(timerWrap);
                    sec.appendChild(container);

                    return { button, checkbox, input, dropdown, listview };
                }

                return { button, checkbox, input, dropdown, listview };
            }

            return { Window, updateStyle: inject };
        })();

        // cheat logic
        const parsedRoomsArray = [];
        const parsedItemsArray = [];


        function getPenguinProfile(pID) {
            _MM_Log(`📡 Requesting profile for ID: ${pID}... Tsekkaa snifferistä vastaus fr!`);
            sendPacket("get_player", {id: pID});
        }

        const TeleportController = {
            timeoutId: null,

            initiate(state, ms) {
                // 1. If state is false (or we just want to force a stop), clear everything
                if (!state) {
                    this.stop();
                    return;
                }

                // 2. Prevent overlapping loops if initiate(true) is called multiple times
                this.stop(); 

                // 3. Define the recursive loop function
                const loop = () => {
                    const randomRoom = parsedRoomsArray[Math.floor(Math.random() * parsedRoomsArray.length)];
                    sendPacket('join_room', { room: parseInt(randomRoom.data2), x: 100, y: 100 });
                    
                    // Call itself again after 'ms' milliseconds
                    this.timeoutId = setTimeout(loop, ms);
                };

                // 4. Start the first tick
                this.timeoutId = setTimeout(loop, ms);
            },

            stop() {
                if (this.timeoutId) {
                    clearTimeout(this.timeoutId);
                    this.timeoutId = null;
                    console.log("Teleport loop stopped.");
                }
            }
        };

        function initiateTeleporting(state, ms){
            if(state){
                TeleportController.initiate(true, ms);
            }
            else
            {
                TeleportController.initiate(false); 
            }
        }

        // --- PLAYER TRACKER LOGIC ---
        // --- ULTIMATE PACKET SNIFFER ENGINE ---
        let packetLog = [];
        let snifferRecording = false; // By default off so we dont nuke RAM
        const MAX_PACKETS = 200; 

        // Builds the pop-up window
        // Builds the pop-up window
        function buildSnifferUI() {
            if (document.getElementById('mm-sniffer-container')) return;

            const wrap = document.createElement('div');
            wrap.id = 'mm-sniffer-container';
            wrap.className = 'mm-sniffer-ui';
            
            // 🔥 TÄSSÄ OLI SE VIKA VELI! Korjattu HTML-rakenne 🔥
            wrap.innerHTML = `
                <div class="mm-sniffer-head" id="mm-sniffer-drag">
                    <span>📡 LIVE PACKET SNIFFER</span>
                    <button class="mm-sniffer-close" onclick="document.getElementById('mm-sniffer-container').classList.remove('open')">✕</button>
                </div>
                <div class="mm-sniffer-tools">
                    <button id="mm-sniff-toggle" style="color:#ff4444; border-color:#ff4444;">⏺ OFF</button>
                    <button onclick="packetLog=[]; document.getElementById('mm-sniffer-content').innerHTML='';">🗑️ CLEAR</button>
                    <button onclick="logPacket('IN', {data: ['message', 'UI_TEST', {msg: 'UI TOIMII VITUN HYVIN FR'}]})">🧪 TEST UI</button>
                </div>
                <div class="mm-sniffer-list" id="mm-sniffer-content"></div>
            `;
            document.body.appendChild(wrap);

            // Toggle record button logic
            const toggleBtn = document.getElementById('mm-sniff-toggle');
            toggleBtn.onclick = () => {
                snifferRecording = !snifferRecording;
                if (snifferRecording) {
                    toggleBtn.textContent = '⏸ RECORDING...';
                    toggleBtn.style.color = '#00ff88';
                    toggleBtn.style.borderColor = '#00ff88';
                } else {
                    toggleBtn.textContent = '⏺ OFF';
                    toggleBtn.style.color = '#ff4444';
                    toggleBtn.style.borderColor = '#ff4444';
                }
            };

            // Basic dragging for the sniffer window
            let isDragging = false, ox, oy;
            const head = document.getElementById('mm-sniffer-drag');
            head.onmousedown = (e) => {
                isDragging = true;
                ox = e.clientX - wrap.getBoundingClientRect().left;
                oy = e.clientY - wrap.getBoundingClientRect().top;
            };
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                wrap.style.left = (e.clientX - ox) + 'px';
                wrap.style.top = (e.clientY - oy) + 'px';
            });
            document.addEventListener('mouseup', () => isDragging = false);
        }

        // Add a packet to the UI live (🔥 FIXED 🔥)
        function renderPacketToSniffer(pData) {
            const list = document.getElementById('mm-sniffer-content');
            if (!list) return;

            const item = document.createElement('div');
            item.className = 'mm-sniffer-item';
            
            const header = document.createElement('div');
            header.className = `mm-sniffer-header ${pData.dir}`;
            header.innerHTML = `
                <span class="mm-sniffer-time">${pData.time}</span>
                <span>${pData.dir === 'IN' ? '📥' : '📤'} ${pData.cmd} ➔ <span style="color:#fff">${pData.subCmd}</span></span>
            `;

            const body = document.createElement('pre');
            body.className = 'mm-sniffer-body';
            
            // 🔥 TÄSSÄ SE FIXI ON: Yritetään stringifyata pelkkä hyötykuorma (data), ettei koko vitun paska kaadu circular erroriin
            try {
                const safeData = pData.raw.data ? pData.raw.data : pData.raw;
                body.textContent = JSON.stringify(safeData, null, 2);
            } catch (err) {
                body.textContent = "💀 [CANNOT PARSE DATA - CIRCULAR REFERENCE]\n" + err.message;
            }

            // Collapsible logic 
            header.onclick = () => body.classList.toggle('open');

            item.appendChild(header);
            item.appendChild(body);
            
            // Shove it at the top
            list.prepend(item);
        }

        function logPacket(direction, rawPayload) {
            if (!snifferRecording) return;
            
            let cmd = "UNKNOWN", subCmd = "UNKNOWN";
            try {
                const args = rawPayload.data || [];
                cmd = args[0] || "N/A";
                subCmd = args[1] || "N/A";
            } catch(e) {}

            const d = new Date();
            const timeStr = `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}.${d.getMilliseconds()}`;

            const pData = { time: timeStr, dir: direction, cmd, subCmd, raw: rawPayload };
            
            packetLog.push(pData);
            if (packetLog.length > MAX_PACKETS) packetLog.shift(); // Remove oldest to save RAM

            renderPacketToSniffer(pData);
        }

        let currentPlayers = [];

        function updatePlayerListUI() {
            const lvContainer = document.getElementById('mm-player-listview');
            if (!lvContainer) return;

            lvContainer.innerHTML = ''; 

            if (currentPlayers.length === 0) {
                lvContainer.innerHTML = '<div class="mm-list-item" style="color:var(--mm-text-mut)">Room is empty...</div>';
                return;
            }

            currentPlayers.forEach(p => {
                const item = document.createElement('div');
                item.className = 'mm-list-item';
                item.innerHTML = `
                    <span class="mm-list-name">${p.username}</span>
                    <span class="mm-list-id">ID: ${p.id}</span>
                `;
                lvContainer.appendChild(item);
            });
        }

        // Koukutetaan peli-socket ja kuunnellaan liikenne (sekä sisään että ulos)
        // ☢️ NUCLEAR LEVEL SOCKET HOOK ☢️
        function hookSocketIncoming() {
            if (!unsafeWindow._MM_SOCKETS || unsafeWindow._MM_SOCKETS.length === 0) {
                setTimeout(hookSocketIncoming, 1000);
                return;
            }

            const socket = unsafeWindow._MM_SOCKETS[0];
            
            if (socket && !socket.hooked) {
                socket.hooked = true;
                _MM_Log("🔥 [SNIFFER] SOCKET LÖYDETTY JA HOOKATTU FR FR 🔥");

                // 1. KOUKUTETAAN ALIMMAN TASON INCOMING (onpacket)
                if (socket.onpacket) {
                    const originalOnPacket = socket.onpacket;
                    socket.onpacket = function(packet) {
                        try {
                            if (snifferRecording) {
                                console.log("📥 [RAW IN] Nappasi:", packet);
                                logPacket('IN', packet);
                            }
                            
                            // VANHA PLAYER TRACKER LOGIIKKA TÄHÄN JOTTA TOIMII
                            const args = packet.data || [];
                            const cmd = args[0], subCmd = args[1], payload = args[2]; 
                            if (cmd === 'message') {
                                if (subCmd === 'add_player' && payload && payload.user) {
                                    const pData = payload.user;
                                    if (!currentPlayers.some(p => p.id === pData.id)) {
                                        currentPlayers.push({ id: pData.id, username: pData.username || pData.realUsername });
                                        updatePlayerListUI();
                                    }
                                } else if (subCmd === 'remove_player' && payload) {
                                    const targetId = typeof payload === 'object' ? payload.id : payload;
                                    currentPlayers = currentPlayers.filter(p => p.id !== parseInt(targetId));
                                    updatePlayerListUI();
                                }
                            }
                        } catch (err) {
                            console.error("💀 [SNIFFER IN] ERROR:", err);
                        }
                        return originalOnPacket.call(this, packet);
                    };
                }

                // 2. KOUKUTETAAN ULOSMENEVÄ (sendRaw)
                if (unsafeWindow._MM_sendRaw) {
                    const originalSendRaw = unsafeWindow._MM_sendRaw;
                    unsafeWindow._MM_sendRaw = function(encodedPacket) {
                        try {
                            if (typeof msgpack !== 'undefined') {
                                const decoded = msgpack.decode(encodedPacket);
                                if (snifferRecording) {
                                    console.log("📤 [RAW OUT] Nappasi:", decoded);
                                    logPacket('OUT', decoded);
                                }
                                
                                if (decoded && decoded.data && decoded.data[1] === 'join_room') {
                                    currentPlayers = [];
                                    updatePlayerListUI();
                                }
                            }
                        } catch(e) {
                            console.error("💀 [SNIFFER OUT] ERROR:", e);
                        }
                        return originalSendRaw.apply(this, arguments);
                    };
                }
            }
            setTimeout(hookSocketIncoming, 2000); 
        }
        hookSocketIncoming();
        buildSnifferUI();

        let antiAFKInterval = null;
        function initiateAntiAFKKick(state) {
            if (state) {
                if (!antiAFKInterval) {
                    antiAFKInterval = setInterval(() => {
                        sendPacket('stamp_earned', {id: 9999}); 
                    }, 300000); // 2 min timer
                }
            } else {
                if (antiAFKInterval) {
                    clearInterval(antiAFKInterval);
                    antiAFKInterval = null; 
                }
            }
        }

        // money printer
        function sendCoinHack(coinAmount, delayMs, timerWrap) {
            _MM_Log("Sent to hack coins");
            // tp to town first
            sendPacket('join_room', { room: 901, x: 100, y: 100 });
            
            if (timerWrap) {
                timerWrap.classList.add('active');
                const textEl = timerWrap.querySelector('.mm-timer-text');
                textEl.style.color = '#ffcc00'; 
                
                let timeLeft = delayMs;

                // calc ms to min:sec
                const formatTime = (ms) => {
                    let totalSec = Math.floor(ms / 1000);
                    let m = Math.floor(totalSec / 60);
                    let s = totalSec % 60;
                    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
                };
                
                textEl.textContent = `WAIT: ${formatTime(timeLeft)}`;
                
                const interval = setInterval(() => {
                    timeLeft -= 1000;
                    
                    if (timeLeft <= 0) {
                        clearInterval(interval);
                        
                        sendPacket('game_over', { coins: coinAmount });
                        
                        textEl.style.color = "var(--mm-theme)";
                        textEl.textContent = "Coins generated. Press X Ingame to collect.";
                        
                        setTimeout(() => {
                            timerWrap.classList.remove('active');
                        }, 3500);
                        
                    } else {
                        textEl.textContent = `WAIT: ${formatTime(timeLeft)}`;
                    }
                }, 1000);
            }
        }

        // init main ui window
        const win = ModMenu.Window("CPL Terminal by Arskiz", { x: 'right', y: '20px', width: '340px' });

        const general = win.addTab("General");
        const playersTab = win.addTab("Players").section("Active Session", "Players in current room");
        playersTab.listview("mm-player-listview");
        
        // Alustetaan tyhjä näkymä heti alkuun
        setTimeout(updatePlayerListUI, 500);

        // coin logic array
        const coinOptions = []

        // vars
        let p_profile_id = Config.get("penguinP_ID");
        let tp_ms = Config.get("tp-ms");

        for(let i = 1; i< 100; i++){
            coinOptions.push({ data1: i * 50, data2: 2000 * i});
        }

        general.section("Player", "Player options")
            .checkbox("Anti Afk Kick", "anti-afk_enabled", false, val => initiateAntiAFKKick(val))
            .checkbox("Example Box 2", "noclip_enabled", false, val => unsafeWindow._MM_Log("No clip:", val))
            .input("Penguin profile ID", "penguinP_ID", "", "ID...", val => {
                p_profile_id = val;
            })
            .button("Open Penguin Profile", "p_profile_open", val => {
                getPenguinProfile(parseInt(p_profile_id));
            });
        general.section("Fun", "Such as fast tp etc..")
            .input("Teleport Delay (ms)", "tp-ms", "", "Input delay...", val => {
                tp_ms = val;
            })
            .checkbox("Activate teleporting", null, false, val => {
                initiateTeleporting(val, tp_ms);
            })

        general.section("Economy")
            .dropdown("Select Coin Amount", coinOptions, "Get Coins", "Wait time", (data1, data2, timerUI) => {
                sendCoinHack(data1, data2, timerUI);
            });

        const roomsSection = win.addTab("Rooms").section("Room Stuff", "Room joiner, etc");
        const loadingTrigger = roomsSection.button("🔄 Syncing Live Map Database...", "yellow");

        const inventory = win.addTab("Inventory").section("Inventory Stuff", "Inventory adder, etc");

        const misc = win.addTab("Settings");
        misc.section("Customization", "Make it look different")
            .input("Theme Color", "theme_color", "#bf0000", "", val => {
                document.documentElement.style.setProperty('--mm-theme', val);
            }, "color")
            .input("Title Color", "title_color", "#ffffff", "", val => {
                document.documentElement.style.setProperty('--mm-title', val);
            }, "color");
        misc.section("Developer Tools")
            .button("📡 Open Packet Sniffer", "blue", () => {
                const snifferWin = document.getElementById('mm-sniffer-container');
                if (snifferWin) snifferWin.classList.toggle('open');
            });

        misc.section("Category 1")
            .checkbox("Example 1", "misc_ex_1", true)
            .checkbox("Example 2", "misc_ex_2", false);

        misc.section("Debug")
            .button("🔍 Dump State", "yellow", () => unsafeWindow._MM_Log('[ModMenu] Sockets:', unsafeWindow._MM_SOCKETS ? unsafeWindow._MM_SOCKETS.length : 0))
            .button("🗑️ Reset Position", "red", () => {
                Config.set('menu_x', null);
                Config.set('menu_y', '20px');
                alert("Refresh the page to reset window position!");
            });

        // fetch game data from api
        const crumbsUrl = "https://media.cplegacy.com/crumbs/en/crumbs.json?v=" + Date.now();
        GM_xmlhttpRequest({
            method: "GET",
            url: crumbsUrl,
            nocache: true,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const rawData = JSON.parse(response.responseText);
                        const roomsObject = rawData.rooms;
                        const itemsObject = rawData.items;
                        
                        
                        for (const id in roomsObject) {
                            if (roomsObject.hasOwnProperty(id)) {
                                const rawName = roomsObject[id].key || "Unknown Room";
                                const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
                                parsedRoomsArray.push({ data1: cleanName, data2: id });
                            }
                        }

                        for (const itemID in itemsObject){
                            if(itemsObject.hasOwnProperty(itemID)){
                                const itemName = itemsObject[itemID].name || "Unknown Item";
                                parsedItemsArray.push({ data1: itemName, data2: itemID });
                            }
                        }

                        const btnEl = document.querySelector('.mm-btn-el.yellow');
                        if (btnEl) btnEl.remove();

                        roomsSection.dropdown("Select Warp Target...", parsedRoomsArray, "Join", "ID", (data1, data2) => {
                            sendPacket("join_room", { room: parseInt(data2), x: 100, y: 100 });
                        });
                        
                        inventory.dropdown("Select item to add", parsedItemsArray, "Add", "ID", (data1, data2) => {
                            sendPacket("add_item", { item: parseInt(data2) });
                        });
                        
                        unsafeWindow._MM_Log(`\nLoaded:\n${parsedRoomsArray.length} rooms.\n${parsedItemsArray.length} items.`);
                    } catch (err) {
                        unsafeWindow._MM_Error("Failed to parse game crumbs data payload.", err);
                    }
                }
            }
        });
    }

    // start loops on load
    runStatusCheckLoop();

    if (document.body) initMenu();
    else document.addEventListener('DOMContentLoaded', initMenu);

})();
