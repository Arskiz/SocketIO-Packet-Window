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
                document.body.appendChild(box);

                let drag = false, ox = 0, oy = 0;
                header.addEventListener('mousedown', e => {
                    drag = true;
                    ox = e.clientX - box.getBoundingClientRect().left;
                    oy = e.clientY - box.getBoundingClientRect().top;
                    box.style.right = 'auto';
                    e.preventDefault();
                });
                document.addEventListener('mousemove', e => {
                    if (!drag) return;
                    const finalX = (e.clientX - ox) + 'px';
                    const finalY = (e.clientY - oy) + 'px';
                    box.style.left = finalX;
                    box.style.top  = finalY;
                    
                    // Save window position on the fly
                    Config.set('menu_x', finalX);
                    Config.set('menu_y', finalY);
                });
                document.addEventListener('mouseup', () => drag = false);

                const tabs = [];

                function addTab(name) {
                    const tabEl = document.createElement('div');
                    tabEl.className = 'mm-tab';
                    tabEl.textContent = name;

                    const bodyEl = document.createElement('div');
                    bodyEl.className = 'mm-body';

                    tabEl.onclick = () => {
                        tabs.forEach(t => { t.el.classList.remove('active'); t.body.classList.remove('active'); });
                        tabEl.classList.add('active');
                        bodyEl.classList.add('active');
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
                console.log("Sent gameover with 100 coins");
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