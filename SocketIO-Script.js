// Inject socket capture into real page context
const script = document.createElement('script');
script.textContent = `
    (function() {
        const _NativeWS = window.WebSocket;
        window._MM_SOCKETS = [];

        window.WebSocket = class extends _NativeWS {
            constructor(url, protocols) {
                super(url, protocols);
                window._MM_SOCKETS.push(this);
                this.addEventListener('close', () => {
                    const i = window._MM_SOCKETS.indexOf(this);
                    if (i !== -1) window._MM_SOCKETS.splice(i, 1);
                });
            }
            send(payload) { super.send(payload); }
        };

        window._MM_sendRaw = function(bytes) {
            if (!window._MM_SOCKETS.length) {
                console.error('[ModMenu] No sockets found');
                return false;
            }
            window._MM_SOCKETS.forEach(s => s.send(bytes));
            return true;
        };
    })();
`;
document.documentElement.appendChild(script);
script.remove();

(function() {
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
            // Replaced static hex with a CSS variable (--mm-theme)
            const style = `
                :root { 
                --mm-theme: ${Config.get('theme_color', '#bf0000')};
                --mm-title: ${Config.get('title_color', '#ffffff')};
                }
                .mm-box{position:fixed;background:#1a1a1a;border:1px solid #333;border-radius:6px;
                min-width:280px;z-index:999999;box-shadow:0 8px 32px rgba(0,0,0,.7);user-select:none}
                .mm-header{background:var(--mm-theme);border-radius:6px 6px 0 0;padding:0 10px;height:34px;
                display:flex;align-items:center;cursor:move;gap:6px}
                .mm-title{flex:1;color:var(--mm-title);font-size:13px;font-weight:bold;letter-spacing:.5px;font-family:Arial}
                .mm-btn-close,.mm-btn-min{width:16px;height:16px;border-radius:50%;border:none;cursor:pointer;
                font-size:10px;display:flex;align-items:center;justify-content:center;color:#fff}
                .mm-btn-close{background:#e83737}.mm-btn-min{background:#e6a817}
                .mm-tabs{display:flex;border-bottom:1px solid #333;background:#111}
                .mm-tab{padding:8px 14px;font-size:12px;color:#888;cursor:pointer;border-bottom:2px solid transparent}
                .mm-tab:hover{color:#ccc}.mm-tab.active{color:#fff;border-bottom-color:var(--mm-theme)}
                .mm-body{padding:12px;display:none;font-family:Arial}.mm-body.active{display:block}
                .mm-section{margin-bottom:14px}
                .mm-section-title{font-size:10px;font-weight:bold;color:var(--mm-theme);text-transform:uppercase;
                letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #2a2a2a}
                .mm-subtitle{font-size:11px;color:#666;margin-bottom:8px;margin-top:-4px}
                .mm-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px}
                .mm-label{font-size:12px;color:#ccc;flex:1}
                .mm-btn-el{padding:7px 10px;background:#222;border:1px solid #444;color:#fff;font-size:12px;
                font-weight:bold;cursor:pointer;border-radius:4px;width:100%;text-align:left;
                margin-bottom:6px;display:block}
                .mm-btn-el:hover{background:#2a2a2a}
                .mm-btn-el.green{color:#00ff88;border-color:#00ff8833}
                .mm-btn-el.blue{color:#33b5e5;border-color:#33b5e533}
                .mm-btn-el.red{color:#ff4444;border-color:#ff444433}
                .mm-btn-el.yellow{color:#ffcc00;border-color:#ffcc0033}
                .mm-input-el{background:#111;border:1px solid #333;color:#fff;font-size:12px;
                padding:6px 8px;border-radius:4px;width:100%;outline:none;font-family:Arial;margin-bottom:6px}
                .mm-input-el:focus{border-color:var(--mm-theme)}
                .mm-cb-wrap{display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px}
                .mm-cb-wrap input{display:none}
                .mm-cb-box{width:16px;height:16px;background:#111;border:1px solid #444;border-radius:3px;
                display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:#fff}
                .mm-cb-wrap input:checked+.mm-cb-box{background:var(--mm-theme);border-color:var(--mm-theme);color:#fff}
                .mm-cb-box::after{content:'';font-size:11px}
                .mm-cb-wrap input:checked+.mm-cb-box::after{content:'✓'}
                .mm-btn-el {
                    padding:7px 10px; background:#222; border:1px solid #444; color:#fff; font-size:12px;
                    font-weight:bold; cursor:pointer; border-radius:4px; width:100%; text-align:left;
                    margin-bottom:6px; display:block;
                    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                }
                /* Micro-pop scale animation when hovering over buttons */
                .mm-btn-el:hover {
                    background:#2a2a2a;
                    transform: scale(1.02);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }
                /* Click shrink animation */
                .mm-btn-el:active {
                    transform: scale(0.97);
                }

                /* Smooth checkmark animation for the checkbox */
                .mm-cb-box {
                    width:16px; height:16px; background:#111; border:1px solid #444; border-radius:3px;
                    display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:11px; color:#fff;
                    transition: all 0.2s ease;
                }
                .mm-cb-wrap:hover .mm-cb-box {
                    border-color: var(--mm-theme);
                    transform: scale(1.08);
                }
                .mm-cb-wrap input:checked + .mm-cb-box {
                    background: var(--mm-theme);
                    border-color: var(--mm-theme);
                    animation: cb-pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                /* Keyframes for a bouncy checkmark pop */
                @keyframes cb-pop {
                    0% { transform: scale(0.6); }
                    100% { transform: scale(1); }
                }
                    .mm-input-el {
    background: #111;
    border: 1px solid #333;
    color: #fff;
    font-size: 12px;
    font-weight: bold;
    padding: 6px 10px;
    border-radius: 4px;
    width: 100%;
    outline: none;
    font-family: Arial;
    margin-bottom: 6px;
    text-align: center; /* Centers the Room ID number so it looks clean */
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.5); /* Deepens the input box */
}

/* Micro-interaction when you hover over the input box */
.mm-input-el:hover {
    border-color: #444;
    background: #141414;
}

/* Dynamic theme glow when you click inside to type */
.mm-input-el:focus {
    border-color: var(--mm-theme);
    background: #161616;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.8), 0 0 8px var(--mm-theme);
}
    /* Add a smooth cubic-bezier transition for sizing updates */
.mm-box {
    position: fixed; background: #1a1a1a; border: 1px solid #333; border-radius: 6px;
    min-width: 280px; z-index: 999999; box-shadow: 0 8px 32px rgba(0,0,0,.7); user-select: none;
    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    max-height: 800px; /* High safety cap */
    overflow: hidden; /* Stops content from spilling during height transitions */
}

/* Update the body segments to handle smooth fading alongside the scaling */
.mm-body {
    padding: 12px;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.25s ease, transform 0.25s ease;
    display: none;
    font-family: Arial;
}

/* When active, trigger a sleek fade-in up-shift macro */
.mm-body.active {
    display: block;
    opacity: 1;
    transform: translateY(0);
}
    .mm-footer {
    background: #111;
    border-top: 1px solid #2a2a2a;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: Arial, sans-serif;
}
.mm-status-label {
    font-size: 10px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: bold;
}
.mm-status-wrapper {
    display: flex;
    align-items: center;
    gap: 6px;
}
.mm-status-text {
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 0.3px;
}
.mm-status-text.connected { color: #00ff88; text-shadow: 0 0 6px rgba(0,255,136,0.3); }
.mm-status-text.disconnected { color: #ff4444; text-shadow: 0 0 6px rgba(255,68,68,0.3); }

/* Small glowing status indicator dot */
.mm-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
}
.mm-status-dot.connected { background: #00ff88; box-shadow: 0 0 6px #00ff88; }
.mm-status-dot.disconnected { background: #ff4444; box-shadow: 0 0 6px #ff4444; }
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
                    width: ${opts.width || '320px'};
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

    if (drag) {
        // 1. Calculate how fast the mouse moved since the last frame
        const currentMouseX = mouseX;
        vx = currentMouseX - lastMouseX;
        vy = mouseY - lastMouseY;
        
        lastMouseX = currentMouseX;
        lastMouseY = mouseY;

        // 2. Standard smooth trailing tracking while mouse is held
        currentX += (targetX - currentX) * lerpSpeed;
        currentY += (targetY - currentY) * lerpSpeed;
        
        // Target tilt is based on raw drag speed (capped at 12 degrees max)
        targetTilt = Math.max(-12, Math.min(12, vx * 0.4));
    } else {
        // 3. INERTIA: If button is released, keep sliding using leftover velocity
        vx *= friction;
        vy *= friction;
        
        if (Math.abs(vx) < 0.05) vx = 0;
        if (Math.abs(vy) < 0.05) vy = 0;
        
        currentX += vx;
        currentY += vy;
        
        // Target tilt bleeds out proportionally to sliding speed
        targetTilt = Math.max(-12, Math.min(12, vx * 0.4));

        if (vx === 0 && vy === 0 && box.style.left !== currentX + 'px') {
            Config.set('menu_x', box.style.left);
            Config.set('menu_y', box.style.top);
        }
    }

    // --- THE FIX: Smooth out the rotation angle separately ---
    // 0.10 gives it a slightly heavier, dampening lag so it transitions like butter
    currentTilt += (targetTilt - currentTilt) * 0.10; 

    // 4. Render calculations directly onto the DOM element using raw hardware transforms
    box.style.left = currentX + 'px';
    box.style.top  = currentY + 'px';
    
    // Apply the newly interpolated, damp-filtered tilt value
    box.style.transform = `rotate(${currentTilt}deg)`;

    // --- Simplified Status Polling ---
    const dotEl = document.getElementById('mm-dot');
    const statusEl = document.getElementById('mm-status');
    
    if (dotEl && statusEl) {
        // Checks strictly if the array exists on unsafeWindow AND has at least 1 socket found
        const hasSockets = !!(unsafeWindow._MM_SOCKETS && unsafeWindow._MM_SOCKETS.length > 0);
        
        if (hasSockets) {
            if (statusEl.textContent !== "INJECTED") {
                statusEl.textContent = "INJECTED";
                statusEl.className = "mm-status-text connected";
                dotEl.className = "mm-status-dot connected";
            }
        } else {
            if (statusEl.textContent !== "NOT INJECTED") {
                statusEl.textContent = "NOT INJECTED";
                statusEl.className = "mm-status-text disconnected";
                dotEl.className = "mm-status-dot disconnected";
            }
        }
    }
    requestAnimationFrame(updatePhysicsLoop);
}

// Fire up the animation engine loop immediately
requestAnimationFrame(updatePhysicsLoop);

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
                    return { button, checkbox, input };
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
                    return { button, checkbox, input };
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
                    return { button, checkbox, input };
                }
                return { button, checkbox, input };
            }

            return { Window, updateStyle: inject };
        })();

        // ---- Your menu ----
        const win = ModMenu.Window("Penguin Cheat Terminal", { x: 'right', y: '20px', width: '340px' });

        // Load saved roomId straight out the gate
        let roomId = Config.get('room_id', '0');

        // --- GENERAL TAB ---
        const general = win.addTab("General");
        general.section("Player", "Player options")
            .checkbox("Text box 1", "speed_hack_enabled", true, val => console.log("Speed hack:", val))
            .checkbox("Text box 2", "noclip_enabled", false, val => console.log("No clip:", val))
            .input("Room ID", "room_id", "0", "0", val => roomId = val)
            .button("Join Room", "blue", () => {
                sendPacket('join_room', {room: parseInt(roomId), x: 100, y: 100 });
            });

        general.section("Economy")
            .button("💸 Get 1000 coins", "green", () => {
                console.log("Joined room 901");
                sendPacket('join_room', { room: 901, x: 100, y: 100 });
                unsafeWindow.setTimeout(() => {
                    sendPacket('game_over', { coins: 1000 });
                }, 5000);
                console.log("Sent gameover with 1000 coins");
            });

        // --- INVENTORY TAB ---
        const combat = win.addTab("Inventory");
        combat.section("Player", "Health & damage modifiers")
            .checkbox("box 1", "inv_box_1", false)
            .checkbox("box 2", "inv_box_2", false);

        // --- MISC & CUSTOMIZATION TAB ---
        const misc = win.addTab("Settings");
        misc.section("Customization", "Make it look different")
        .input("Theme Color", "theme_color", "#bf0000", "", val => {
            document.documentElement.style.setProperty('--mm-theme', val);
        }, "color")

        .input("Title Color", "title_color", "#ffffff", "", val => {
            document.documentElement.style.setProperty('--mm-title', val);
        }, "color");

        misc.section("Category 1")
            .checkbox("Example 1", "misc_ex_1", true)
            .checkbox("Example 2", "misc_ex_2", false);
            
        misc.section("Debug")
            .button("🔍 Dump State", "yellow", () => console.log('[ModMenu] Sockets:', unsafeWindow._MM_SOCKETS.length))
            .button("🗑️ Reset Position", "red", () => {
                Config.set('menu_x', null);
                Config.set('menu_y', '20px');
                alert("Refresh the page to reset window position!");
            });
    }

    if (document.body) initMenu();
    else document.addEventListener('DOMContentLoaded', initMenu);

})();