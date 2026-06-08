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
                header.innerHTML = `<span class="mm-title">${title}</span>`;

                const minBtn = document.createElement('button');
                minBtn.className = 'mm-btn-min';
                let minimised = false;
                minBtn.onclick = () => {
                    minimised = !minimised;
                    inner.style.display = minimised ? 'none' : '';
                };

                const closeBtn = document.createElement('button');
                closeBtn.className = 'mm-btn-close';
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
                    <span class="mm-status-label">SYS_STATE</span>
                    <div class="mm-status-wrapper">
                        <span id="mm-dot" class="mm-status-dot disconnected"></span>
                        <span id="mm-status" class="mm-status-text disconnected">OFFLINE</span>
                    </div>
                `;
                box.appendChild(footer);
                document.body.appendChild(box);

                let drag = false;
                let ox = 0, oy = 0, mouseX = 0, mouseY = 0, currentX = 0, currentY = 0, targetX = 0, targetY = 0;
                let vx = 0, vy = 0, lastMouseX = 0, lastMouseY = 0;
                const lerpSpeed = 0.15, friction = 0.92;

                const rect = box.getBoundingClientRect();
                currentX = targetX = rect.left;
                currentY = targetY = rect.top;

                header.addEventListener('mousedown', e => {
                    drag = true;
                    ox = e.clientX - box.getBoundingClientRect().left;
                    oy = e.clientY - box.getBoundingClientRect().top;
                    mouseX = lastMouseX = e.clientX;
                    mouseY = lastMouseY = e.clientY;
                    targetX = mouseX - ox;
                    targetY = mouseY - oy;
                    vx = vy = 0;
                    box.style.right = 'auto';
                    e.preventDefault();
                });

                document.addEventListener('mousemove', e => {
                    if (!drag) return;
                    mouseX = e.clientX; mouseY = e.clientY;
                    targetX = mouseX - ox; targetY = mouseY - oy;
                });

                document.addEventListener('mouseup', () => { if (drag) drag = false; });

                let currentTilt = 0;

                function updatePhysicsLoop() {
                    let targetTilt = 0;
                    const boxRect = box.getBoundingClientRect();
                    const boxWidth = boxRect.width, boxHeight = boxRect.height;
                    const screenWidth = window.innerWidth, screenHeight = window.innerHeight;

                    if (drag) {
                        const currentMouseX = mouseX;
                        vx = currentMouseX - lastMouseX; vy = mouseY - lastMouseY;
                        lastMouseX = currentMouseX; lastMouseY = mouseY;
                        currentX += (targetX - currentX) * lerpSpeed;
                        currentY += (targetY - currentY) * lerpSpeed;
                        targetTilt = Math.max(-8, Math.min(8, vx * 0.3));
                    } else {
                        vx *= friction; vy *= friction;
                        if (Math.abs(vx) < 0.05) vx = 0;
                        if (Math.abs(vy) < 0.05) vy = 0;
                        currentX += vx; currentY += vy;
                        targetTilt = Math.max(-8, Math.min(8, vx * 0.3));

                        if (vx === 0 && vy === 0 && box.style.left !== currentX + 'px') {
                            Config.set('menu_x', box.style.left); Config.set('menu_y', box.style.top);
                        }
                    }

                    const elasticity = 0.5;
                    if (currentX < 0) { currentX = 0; vx = -vx * elasticity; } 
                    else if (currentX + boxWidth > screenWidth) { currentX = screenWidth - boxWidth; vx = -vx * elasticity; }
                    if (currentY < 0) { currentY = 0; vy = -vy * elasticity; } 
                    else if (currentY + boxHeight > screenHeight) { currentY = screenHeight - boxHeight; vy = -vy * elasticity; }

                    currentTilt += (targetTilt - currentTilt) * 0.15;
                    box.style.left = currentX + 'px';
                    box.style.top = currentY + 'px';
                    box.style.transform = `rotate(${currentTilt}deg)`;

                    requestAnimationFrame(updatePhysicsLoop);
                }

                requestAnimationFrame(updatePhysicsLoop);
                document.addEventListener('keydown', (e) => {
                    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) return;
                    if (e.ctrlKey && e.shiftKey && (e.keyCode === 88 || e.key.toLowerCase() === 'x')) {
                        e.preventDefault(); e.stopPropagation();
                        if (box) {
                            const centerX = Math.max(50, (window.innerWidth / 2) - 180);
                            const centerY = Math.max(50, (window.innerHeight / 2) - 200);
                            box.style.left = centerX + 'px'; box.style.top = centerY + 'px'; box.style.transform = 'none';
                            currentX = targetX = centerX; currentY = targetY = centerY;
                            vx = vy = currentTilt = 0;
                            Config.set('menu_x', centerX + 'px'); Config.set('menu_y', centerY + 'px');
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

                        bodyEl.style.display = 'block'; bodyEl.style.position = 'absolute'; bodyEl.style.visibility = 'hidden';
                        box.style.maxHeight = 'none';
                        const targetHeight = header.getBoundingClientRect().height + tabBar.getBoundingClientRect().height + bodyEl.scrollHeight + 40;
                        bodyEl.style.display = ''; bodyEl.style.position = ''; bodyEl.style.visibility = '';

                        tabs.forEach(t => t.body.classList.remove('active'));
                        bodyEl.classList.add('active');

                        box.style.maxHeight = oldHeight + 'px';
                        void box.offsetHeight;
                        box.style.maxHeight = targetHeight + 'px';

                        setTimeout(() => { box.style.maxHeight = ''; }, 400);
                    };

                    tabBar.appendChild(tabEl);
                    tabContent.appendChild(bodyEl);
                    tabs.push({ el: tabEl, body: bodyEl });

                    if (tabs.length === 1) { tabEl.classList.add('active'); bodyEl.classList.add('active'); }
                    return Tab(bodyEl);
                }

                return { addTab };
            }

            function Tab(container) {
                function section(title, subtitle) {
                    const sec = document.createElement('div');
                    sec.className = 'mm-section';
                    sec.innerHTML = `<div class="mm-section-title">${title}</div>${subtitle ? `<div class="mm-subtitle">${subtitle}</div>` : ''}`;
                    container.appendChild(sec);
                    return Section(sec);
                }
                return { section };
            }

            function Section(sec) {
                function button(label, color, onClick) {
                    const btn = document.createElement('button');
                    btn.className = `mm-btn-el${color ? ' ' + color : ''}`;
                    btn.textContent = label;
                    btn.onclick = onClick || null;
                    sec.appendChild(btn);
                    return { button, checkbox, input, dropdown };
                }
                function checkbox(label, configKey, defaultVal, onChange) {
                    const wrap = document.createElement('label');
                    wrap.className = 'mm-cb-wrap';
                    const inp = document.createElement('input');
                    inp.type = 'checkbox';
                    inp.checked = Config.get(configKey, defaultVal);

                    const box = document.createElement('span');
                    box.className = 'mm-cb-box';
                    const lbl = document.createElement('span');
                    lbl.className = 'mm-label';
                    lbl.textContent = label;
                    
                    wrap.appendChild(inp);
                    wrap.appendChild(box);
                    wrap.appendChild(lbl);

                    inp.onchange = () => {
                        if (typeof AudioFX !== 'undefined' && AudioFX.playToggle) AudioFX.playToggle(inp.checked);
                        Config.set(configKey, inp.checked);
                        if (onChange) onChange(inp.checked);
                    };

                    sec.appendChild(wrap);
                    return { button, checkbox, input, dropdown };
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
                        inp.style.cssText = 'width: 48px; height: 28px; border: none; background: none; cursor: pointer; padding: 0; border-radius: 4px; box-shadow: none;';
                    } else {
                        inp.style.width = '140px';
                    }

                    inp.value = Config.get(configKey, defaultVal);
                    inp.oninput = () => {
                        Config.set(configKey, inp.value);
                        if (onChange) onChange(inp.value);
                    };

                    row.appendChild(inp);
                    sec.appendChild(row);
                    return { button, checkbox, input, dropdown };
                }
                function dropdown(label, dataArray, actionBtnLabel, onSelect) {
                    const container = document.createElement('div');
                    container.className = 'mm-dropdown-container';

                    const trigger = document.createElement('button');
                    trigger.className = 'mm-dropdown-trigger';
                    trigger.innerHTML = `<span>${label}</span> <span style="font-size: 10px;">▼</span>`;
                    
                    const menu = document.createElement('div');
                    menu.className = 'mm-dropdown-menu';

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
                            <span class="mm-dd-title">${itemData.title}</span>
                            <span class="mm-dd-id">ID: ${itemData.id}</span>
                        `;

                        const actionBtn = document.createElement('button');
                        actionBtn.className = 'mm-dd-join-btn';
                        actionBtn.textContent = actionBtnLabel;
                        
                        actionBtn.onclick = (e) => {
                            e.stopPropagation();
                            if (typeof AudioFX !== 'undefined' && AudioFX.playClick) AudioFX.playClick();
                            if (typeof onSelect === 'function') onSelect(itemData.id, itemData.title);
                            menu.classList.remove('open');
                        };

                        item.appendChild(actionBtn);
                        menu.appendChild(item);
                    });

                    container.appendChild(trigger);
                    container.appendChild(menu);
                    sec.appendChild(container);

                    return { button, checkbox, input, dropdown };
                }
                return { button, checkbox, input, dropdown };
            }

            return { Window, updateStyle: inject };
        })();

        const win = ModMenu.Window("Penguin Cheat Terminal", { x: 'right', y: '20px', width: '380px' });

        const general = win.addTab("General");
        general.section("Player Mechanics", "Player movement & physics")
            .checkbox("Speed Hack", "speed_hack_enabled", true, val => unsafeWindow._MM_Log("Speed hack:", val))
            .checkbox("No-Clip", "noclip_enabled", false, val => unsafeWindow._MM_Log("No clip:", val));

        general.section("Economy Setup", "Money injections")
            .button("💸 Inject 1000 Coins", "green", () => {
                unsafeWindow._MM_Log("Joined room 901");
                sendPacket('join_room', { room: 901, x: 100, y: 100 });
                unsafeWindow.setTimeout(() => {
                    sendPacket('game_over', { coins: 1000 });
                }, 5000);
                unsafeWindow._MM_Log("Sent gameover with 1000 coins");
            });

        const roomsSection = win.addTab("Rooms").section("Database Sync", "Live room list fetching");
        const inventory = win.addTab("Inventory").section("Item Spawner", "Add gear to account");

        const misc = win.addTab("Settings");
        misc.section("Aesthetics", "Configure UI appearance")
            .input("Accent Glow", "theme_color", "#ff2a2a", "", val => {
                document.documentElement.style.setProperty('--mm-theme', val);
            }, "color")
            .input("Header Text", "title_color", "#ffffff", "", val => {
                document.documentElement.style.setProperty('--mm-title', val);
            }, "color");

        misc.section("System Utilities")
            .button("🔍 Dump Sockets", "blue", () => unsafeWindow._MM_Log('[ModMenu] Sockets:', unsafeWindow._MM_SOCKETS.length))
            .button("🗑️ Reset UI Position", "red", () => {
                Config.set('menu_x', null); Config.set('menu_y', '20px');
                alert("Hit F5 to reset window pos bro!");
            });
        
        const loadingTrigger = roomsSection.button("🔄 Syncing Live Map Database...", "yellow");
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
                        
                        const parsedRoomsArray = [];
                        const parsedItemsArray = [];

                        for (const id in roomsObject) {
                            if (roomsObject.hasOwnProperty(id)) {
                                const rawName = roomsObject[id].key || "Unknown Room";
                                parsedRoomsArray.push({ title: rawName.charAt(0).toUpperCase() + rawName.slice(1), id: id });
                            }
                        }

                        for (const itemID in itemsObject){
                            if(itemsObject.hasOwnProperty(itemID)){
                                parsedItemsArray.push({ title: itemsObject[itemID].name || "Unknown Item", id: itemID });
                            }
                        }

                        const btnEl = document.querySelector('.mm-btn-el.yellow');
                        if (btnEl) btnEl.remove();

                        roomsSection.dropdown("🌐 Select Warp Target...", parsedRoomsArray, "Warp", (id, title) => {
                            sendPacket("join_room", { room: parseInt(id), x: 100,})
                        });
                        inventory.dropdown("Select Item ID", parsedItemsArray, "Spawn", (id, title) => {
                            sendPacket("add_item", { item: parseInt(id)})
                        });
                        unsafeWindow._MM_Log(`Successfully compiled ${parsedRoomsArray.length} rooms natively.`);

                    } catch (err) {
                        unsafeWindow._MM_Error("Failed to parse game crumbs data.", err);
                    }
                }
            }
        });
    }

    function startMenuEngine() {
        const hasActiveSocket = !!(unsafeWindow._MM_SOCKETS && unsafeWindow._MM_SOCKETS.length > 0);
        if (hasActiveSocket) {
            unsafeWindow._MM_Log("[ModMenu] Active WebSocket found! Launching UI...");
            if (document.body) initMenu();
            else document.addEventListener('DOMContentLoaded', initMenu);
        } else {
            setTimeout(startMenuEngine, 500);
        }
    }

    function runStatusCheckLoop() {
        const statusText = document.getElementById('mm-status');
        const statusDot = document.getElementById('mm-dot');
        const isSocketActive = !!(unsafeWindow._MM_SOCKETS && unsafeWindow._MM_SOCKETS.length > 0);

        if (statusText && statusDot) {
            if (isSocketActive) {
                statusText.className = 'mm-status-text connected';
                statusText.textContent = 'LINKED';
                statusDot.className = 'mm-status-dot connected';
            } else {
                statusText.className = 'mm-status-text disconnected';
                statusText.textContent = 'NO SIGNAL';
                statusDot.className = 'mm-status-dot disconnected';
            }
        }
        setTimeout(runStatusCheckLoop, 1000);
    }

    startMenuEngine();
    runStatusCheckLoop();
})();
