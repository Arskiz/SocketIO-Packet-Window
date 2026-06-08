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
            osc.frequency.setValueAtTime(600, ctx.currentTime); // Start high
            osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08); // Drop fast

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
            const endFreq = isOn ? 800 : 150; // High beep for ON, low bloop for OFF

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
                    font-size: 0; /* Hide text */
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

                // Load saved position if it exists, otherwise use defaults
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
                box.appendChild(footer); // Appended directly to box so it's globally static
                document.body.appendChild(box);

                // --- Advanced Kinetic Dragging & Tilt Engine ---
                let drag = false;
                let ox = 0, oy = 0;             // Mouse offset relative to window top-left
                let mouseX = 0, mouseY = 0;       // Current global mouse coordinates
                let currentX = 0, currentY = 0;   // Current interpolated window coordinates
                let targetX = 0, targetY = 0;     // Target destination coordinates

                // Velocity & Inertia variables
                let vx = 0, vy = 0;               // Current velocity vectors
                let lastMouseX = 0, lastMouseY = 0; // Tracking previous frame for speed calc
                const lerpSpeed = 0.15;           // Smooth tracking weight (0.1 - 0.2 is best)
                const friction = 0.92;            // Slide duration after release (lower = stops faster)

                // Parse initial coordinates out of your box styles safely
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

                    // Kill any active slide velocity immediately when grabbed again
                    vx = 0;
                    vy = 0;

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

                document.addEventListener('mouseup', () => {
                    if (drag) {
                        drag = false;
                    }
                });

                // --- Physics Engine Variables (Add this right above updatePhysicsLoop) ---
                let currentTilt = 0; // Tracks the interpolated smooth rotation value

                function updatePhysicsLoop() {
                    let targetTilt = 0;

                    // Get the dynamic dimensions of the terminal box and viewport right now
                    const boxRect = box.getBoundingClientRect();
                    const boxWidth = boxRect.width;
                    const boxHeight = boxRect.height;

                    const screenWidth = window.innerWidth;
                    const screenHeight = window.innerHeight;

                    if (drag) {
                        const currentMouseX = mouseX;
                        vx = currentMouseX - lastMouseX;
                        vy = mouseY - lastMouseY;

                        lastMouseX = currentMouseX;
                        lastMouseY = mouseY;

                        currentX += (targetX - currentX) * lerpSpeed;
                        currentY += (targetY - currentY) * lerpSpeed;

                        targetTilt = Math.max(-12, Math.min(12, vx * 0.4));
                    } else {
                        // --- INERTIA SLIDE ---
                        vx *= friction;
                        vy *= friction;

                        if (Math.abs(vx) < 0.05) vx = 0;
                        if (Math.abs(vy) < 0.05) vy = 0;

                        currentX += vx;
                        currentY += vy;

                        targetTilt = Math.max(-12, Math.min(12, vx * 0.4));

                        // Periodically save final static placement once everything goes completely dead silent
                        if (vx === 0 && vy === 0 && box.style.left !== currentX + 'px') {
                            Config.set('menu_x', box.style.left);
                            Config.set('menu_y', box.style.top);
                        }
                    }

                    // 🚨 --- THE SECRET SAUCE: WALL COLLISION BOUNCE DETECTORS ---
                    // Elasticity controls how hard it bounces. 0.6 means it keeps 60% of its speed when hitting a wall.
                    const elasticity = 0.6;

                    // LEFT & RIGHT WALLS
                    if (currentX < 0) {
                        currentX = 0;        // Snap back to inside edge
                        vx = -vx * elasticity; // Flip speed vector to opposite direction
                    } else if (currentX + boxWidth > screenWidth) {
                        currentX = screenWidth - boxWidth;
                        vx = -vx * elasticity;
                    }

                    // TOP & BOTTOM WALLS
                    if (currentY < 0) {
                        currentY = 0;
                        vy = -vy * elasticity;
                    } else if (currentY + boxHeight > screenHeight) {
                        currentY = screenHeight - boxHeight;
                        vy = -vy * elasticity;
                    }

                    // --- Smooth out the rotation angle separately ---
                    currentTilt += (targetTilt - currentTilt) * 0.10;

                    // Render direct coordinates onto the DOM
                    box.style.left = currentX + 'px';
                    box.style.top = currentY + 'px';
                    box.style.transform = `rotate(${currentTilt}deg)`;

                    requestAnimationFrame(updatePhysicsLoop);
                }

                // Fire up the animation engine loop immediately
                requestAnimationFrame(updatePhysicsLoop);
                document.addEventListener('keydown', (e) => {
                    // 1. CHAT GUARD: Skip if typing inside the game chat or inputs
                    if (document.activeElement && (
                        document.activeElement.tagName === 'INPUT' ||
                        document.activeElement.tagName === 'TEXTAREA' ||
                        document.activeElement.isContentEditable
                    )) {
                        return;
                    }

                    // 2. HARDWARE KEY CHECK: Ctrl (ctrlKey) + Shift (shiftKey) + X (keyCode 88)
                    // Using e.keyCode bypasses any string/case issues caused by the browser
                    const isXKey = e.keyCode === 88 || e.key.toLowerCase() === 'x';

                    if (e.ctrlKey && e.shiftKey && isXKey) {
                        e.preventDefault();
                        e.stopPropagation(); // Stops any other scripts from hijacking the input

                        if (box) {
                            // Calculate exact math center of current window viewport dynamically
                            const centerX = Math.max(50, (window.innerWidth / 2) - 140);
                            const centerY = Math.max(50, (window.innerHeight / 2) - 200);

                            // Force physical DOM properties instantly
                            box.style.left = centerX + 'px';
                            box.style.top = centerY + 'px';
                            box.style.transform = 'none';

                            // FORCE OVERWRITE your loop's tracking variables so it stays center
                            // (Make sure these variable names match exactly what your loop uses!)
                            if (typeof currentX !== 'undefined') currentX = centerX;
                            if (typeof targetX !== 'undefined') targetX = centerX;
                            if (typeof currentY !== 'undefined') currentY = centerY;
                            if (typeof targetY !== 'undefined') targetY = centerY;
                            if (typeof vx !== 'undefined') vx = 0;
                            if (typeof vy !== 'undefined') vy = 0;
                            if (typeof currentTilt !== 'undefined') currentTilt = 0;

                            // Save the clean recovery location to your persistent storage
                            Config.set('menu_x', centerX + 'px');
                            Config.set('menu_y', centerY + 'px');

                            unsafeWindow._MM_Log("🎯 HARDWARE RECOVERY: Menu snapped back to center screen!");
                        } else {
                            unsafeWindow._MM_Error("Recovery failed: .mm-box element was not found in scope.");
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

                    // 🚨 REPLACE YOUR OLD tabEl.onclick WITH THIS JUICED VERSION HERE:
                    tabEl.onclick = () => {
                        // 1. Capture the starting height before doing anything
                        const oldHeight = box.getBoundingClientRect().height;
                        box.style.maxHeight = oldHeight + 'px';

                        // 2. Temporarily let the new body render, but keep old ones active for calculation
                        const currentActiveBody = [...tabContent.children].find(b => b.classList.contains('active'));

                        tabs.forEach(t => t.el.classList.remove('active'));
                        tabEl.classList.add('active');

                        // Force target body to display block so we can measure it, but hide opacity
                        bodyEl.style.display = 'block';
                        bodyEl.style.position = 'absolute'; // Pop it out of flow so it doesn't bloat the screen
                        bodyEl.style.visibility = 'hidden';

                        // 3. Force reflow to calculate what the absolute new target height WILL be
                        box.style.maxHeight = 'none';

                        // We calculate the header + tabs + the new body's height manually
                        const headerHeight = header.getBoundingClientRect().height;
                        const tabsBarHeight = tabBar.getBoundingClientRect().height;
                        const padding = 24; // padding-top + padding-bottom of mm-body (12px + 12px)
                        const newBodyHeight = bodyEl.scrollHeight + padding;
                        const targetHeight = headerHeight + tabsBarHeight + newBodyHeight;

                        // 4. Clean up the temporary measuring styles
                        bodyEl.style.display = '';
                        bodyEl.style.position = '';
                        bodyEl.style.visibility = '';

                        // 5. Now safely execute the real class swap
                        tabs.forEach(t => t.body.classList.remove('active'));
                        bodyEl.classList.add('active');

                        // 6. Snap back to old height instantly, then transition to the smaller target height
                        box.style.maxHeight = oldHeight + 'px';
                        void box.offsetHeight; // Force layout engine reflow

                        box.style.maxHeight = targetHeight + 'px';

                        // 7. Wipe inline max-height after transition finishes so dragging remains unbugged
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

                    // Fetch from persistent config
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
                        Config.set(configKey, inp.checked);
                        if (onChange) onChange(inp.checked);
                    };

                    sec.appendChild(wrap);
                    return { button, checkbox, input, dropdown };
                }
                // Added a value argument to handle loaded data properly
                function input(label, configKey, defaultVal, placeholder, onChange, inputType = 'text') {
                    const row = document.createElement('div');
                    row.className = 'mm-row';
                    row.innerHTML = `<span class="mm-label">${label}</span>`;

                    const inp = document.createElement('input');
                    inp.className = 'mm-input-el';
                    inp.type = inputType; // Allows switching between 'text', 'color', 'number', etc.
                    inp.placeholder = placeholder || '';

                    // Quick style polish: color pickers look better with a square aspect ratio or custom width
                    if (inputType === 'color') {
                        inp.style.cssText = 'width: 44px; height: 28px; border: 1px solid var(--mm-border); background: rgba(0,0,0,0.3); cursor: pointer; padding: 0; border-radius: 4px;';
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
                    return { button, checkbox, input, dropdown };
                }
                function dropdown(label, dataArray, actionBtnLabel, onSelect) {
    const container = document.createElement('div');
    container.className = 'mm-dropdown-container';

    // 1. Dropdown main trigger header element
    const trigger = document.createElement('button');
    trigger.className = 'mm-dropdown-trigger';
    trigger.innerHTML = `<span>${label}</span> <span class="mm-dd-arrow" style="font-size: 10px; color: var(--mm-theme);">▼</span>`;
    
    // 2. Hidden scrollable menu sheet
    const menu = document.createElement('div');
    menu.className = 'mm-dropdown-menu';

    // Auto-close overlay if you click outside the component
    const closeOnOutsideClick = (e) => {
        if (!container.contains(e.target)) {
            menu.classList.remove('open');
            document.removeEventListener('click', closeOnOutsideClick);
        }
    };

    trigger.onclick = (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.contains('open');
        
        // Close any other open cheat menus on screen to prevent overlap bloating
        document.querySelectorAll('.mm-dropdown-menu').forEach(m => m.classList.remove('open'));
        
        if (!isOpen) {
            menu.classList.add('open');
            document.addEventListener('click', closeOnOutsideClick);
        }
    };

    // 3. Populate custom side-by-side flex list rows dynamically
    dataArray.forEach(itemData => {
        const item = document.createElement('div');
        item.className = 'mm-dropdown-item';

        // Flex structure layout: Title text -> Monospace ID box
        item.innerHTML = `
            <span class="mm-dd-title">${itemData.title}</span>
            <span class="mm-dd-id">ID: ${itemData.id}</span>
        `;

        // Dedicated inline action button
        const actionBtn = document.createElement('button');
        actionBtn.className = 'mm-dd-join-btn'; // Keeps your existing CSS styles perfectly intact
        actionBtn.textContent = actionBtnLabel;
        
        actionBtn.onclick = (e) => {
            e.stopPropagation(); // Stops the container click loop from re-opening things
            if (typeof AudioFX !== 'undefined' && AudioFX.playClick) AudioFX.playClick();
            
            // 🚨 THE FIX: Execute the unique custom callback passed via your layout setup
            if (typeof onSelect === 'function') {
                onSelect(itemData.id, itemData.title);
            }
            
            menu.classList.remove('open'); // Close list view after action completes
        };

        item.appendChild(actionBtn);
        menu.appendChild(item);
    });

    container.appendChild(trigger);
    container.appendChild(menu);
    sec.appendChild(container);

    // Make sure to update the return block so method chaining (.button(), etc.) doesn't break!
    return { button, checkbox, input, dropdown };
}
                return { button, checkbox, input, dropdown };
                
            }

            return { Window, updateStyle: inject };
        })();

        /////////////////////////////////////////
        // MAIN TERMINAL - MENU ITSELF
        /////////////////////////////////////////

        const win = ModMenu.Window("Penguin Cheat Terminal", { x: 'right', y: '20px', width: '340px' });

        // Load saved roomId straight out the gate
        const MenuState = {
            itemID: "0",
            roomID: "1",
            customWarp: "0"
        };

        // --- GENERAL TAB ---
        const general = win.addTab("General");
        general.section("Player", "Player options")
            .checkbox("Text box 1", "speed_hack_enabled", true, val => unsafeWindow._MM_Log("Speed hack:", val))
            .checkbox("Text box 2", "noclip_enabled", false, val => unsafeWindow._MM_Log("No clip:", val));

        general.section("Economy")
            .button("💸 Get 1000 coins", "green", () => {
                unsafeWindow._MM_Log("Joined room 901");
                sendPacket('join_room', { room: 901, x: 100, y: 100 });
                unsafeWindow.setTimeout(() => {
                    sendPacket('game_over', { coins: 1000 });
                }, 5000);
                unsafeWindow._MM_Log("Sent gameover with 1000 coins");
            });

        // =========================================================================
        // 🔄 ASYNC LIVE CRUMBS FETCHER (Dynamically builds the dropdown)
        // =========================================================================
        const roomsSection = win.addTab("Rooms").section("Room Stuff", "Room joiner, etc");

        // --- INVENTORY TAB ---
        const inventory = win.addTab("Inventory").section("Inventory Stuff", "Inventory adder, etc");

        // --- MISC & CUSTOMIZATION TAB ---
        const misc = win.addTab("Settings");
        misc.section("Customization", "Make it look different")
            .input("Theme Color", "theme_color", "#ff2a5f", "", val => {
                document.documentElement.style.setProperty('--mm-theme', val);
            }, "color")

            .input("Title Color", "title_color", "#ffffff", "", val => {
                document.documentElement.style.setProperty('--mm-title', val);
            }, "color");

        misc.section("Category 1")
            .checkbox("Example 1", "misc_ex_1", true)
            .checkbox("Example 2", "misc_ex_2", false);

        misc.section("Debug")
            .button("🔍 Dump State", "yellow", () => unsafeWindow._MM_Log('[ModMenu] Sockets:', unsafeWindow._MM_SOCKETS.length))
            .button("🗑️ Reset Position", "red", () => {
                Config.set('menu_x', null);
                Config.set('menu_y', '20px');
                alert("Refresh the page to reset window position!");
            });
        
        // Render a temporary loading message inside your custom architecture
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
                        const roomsObject = rawData.rooms; // Grabs the exact block from your image
                        const itemsObject = rawData.items;
                        
                        const parsedRoomsArray = [];
                        const parsedItemsArray = [];

                        // Iterate through the JSON key hashes dynamically
                        for (const id in roomsObject) {
                            if (roomsObject.hasOwnProperty(id)) {
                                // Capitalize the key string (e.g., "town" -> "Town", "coffee" -> "Coffee")
                                const rawName = roomsObject[id].key || "Unknown Room";
                                const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

                                parsedRoomsArray.push({
                                    title: cleanName,
                                    id: id
                                });
                            }
                        }

                        for (const itemID in itemsObject){
                            if(itemsObject.hasOwnProperty(itemID)){
                                const itemName = itemsObject[itemID].name || "Unknown Item";
                                
                                parsedItemsArray.push({
                                    title: itemName,
                                    id: itemID
                                });
                            }
                        }

                        
                        // Remove the loading button element to clean up the UI view
                        const btnEl = document.querySelector('.mm-btn-el.yellow');
                        if (btnEl) btnEl.remove();

                        // Inject your premium flex dropdown populated with the live parsed array data
                        roomsSection.dropdown("🌐 Select Warp Target...", parsedRoomsArray, "Join", (id, title) => {
                            sendPacket("join_room", { room: parseInt(id), x: 100,})
                        });
                        inventory.dropdown("Select item to add", parsedItemsArray, "Add", (id, title) => {
                            sendPacket("add_item", { item: parseInt(id)})
                        });
                        unsafeWindow._MM_Log(`Successfully compiled ${parsedRoomsArray.length} rooms natively from game servers.`);

                    } catch (err) {
                        unsafeWindow._MM_Error("Failed to parse game crumbs data payload.", err);
                    }
                } else {
                    unsafeWindow._MM_Error("CPLegacy media servers dropped the request. Status:", response.status);
                }
            },
            onerror: function(err) {
                unsafeWindow._MM_Error("Network error while communicating with crumbs asset CDN.", err);
            }
        });
    }

    if (document.body) initMenu();
    else document.addEventListener('DOMContentLoaded', initMenu);

})();

function startMenuEngine() {
    // Check if unsafeWindow._MM_SOCKETS exists and actually has a socket inside it
    const hasActiveSocket = !!(unsafeWindow._MM_SOCKETS && unsafeWindow._MM_SOCKETS.length > 0);

    if (hasActiveSocket) {
        unsafeWindow._MM_Log("[ModMenu] Active WebSocket found! Launching UI...");

        // Launch your menu only when the game is ready
        if (document.body) initMenu();
        else document.addEventListener('DOMContentLoaded', initMenu);
    } else {
        // If no socket is found yet, check again in 500ms
        unsafeWindow._MM_Log("[ModMenu] Waiting for Club Penguin to open a socket connection...");
        setTimeout(startMenuEngine, 500);
    }
}

// Start the polling bootstrapper
startMenuEngine();

function runStatusCheckLoop() {
    const statusText = document.getElementById('mm-status');
    const statusDot = document.getElementById('mm-dot');

    // Check if our injection hook has successfully trapped an active game socket
    const isSocketActive = !!(unsafeWindow._MM_SOCKETS && unsafeWindow._MM_SOCKETS.length > 0);

    if (statusText && statusDot) {
        if (isSocketActive) {
            // Swap classes to trigger your green CSS glow rules
            statusText.className = 'mm-status-text connected';
            statusText.textContent = 'INJECTED';
            
            statusDot.className = 'mm-status-dot connected';
        } else {
            // Stay red if the socket drops or hasn't opened yet
            statusText.className = 'mm-status-text disconnected';
            statusText.textContent = 'NOT INJECTED';
            
            statusDot.className = 'mm-status-dot disconnected';
        }
    }

    // Poll every 1000ms so it updates instantly without lagging your game loop
    setTimeout(runStatusCheckLoop, 1000);
}

// Fire up the status loop alongside your main initialization
runStatusCheckLoop();
