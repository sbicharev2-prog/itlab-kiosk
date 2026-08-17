const {
    app,
    BrowserWindow,
    globalShortcut,
    ipcMain,
    screen
} = require('electron');

const https = require('https');
const os = require('os');
const path = require('path');

// ============================================================
// НАСТРОЙКИ
// ============================================================

const SHOP_URL = 'https://sklep.itlabstore.pl/';
const ADMIN_PIN = '0808';

let shopWindow = null;
let adminWindow = null;
let pinWindow = null;
let splashWindow = null;
let offlineWindow = null;

// ============================================================
// LOG
// ============================================================

function log(message) {
    console.log(message);
}

// ============================================================
// IP-АДРЕСА
// ============================================================

function getLocalIPs() {

    const interfaces = os.networkInterfaces();

    const ips = [];

    for (const name of Object.keys(interfaces)) {

        for (const net of interfaces[name] || []) {

            if (
                net.family === 'IPv4' &&
                !net.internal
            ) {

                ips.push({
                    name: name,
                    address: net.address
                });
            }
        }
    }

    return ips;
}

function getMainIP() {

    const ips = getLocalIPs();

    if (ips.length > 0) {
        return ips[0].address;
    }

    return 'IP не найден';
}

// ============================================================
// ПРОВЕРКА САЙТА
// ============================================================

function checkShopOnline() {

    return new Promise((resolve) => {

        let finished = false;

        const finish = (result) => {

            if (finished) {
                return;
            }

            finished = true;
            resolve(result);
        };

        try {

            const request = https.get(
                SHOP_URL,
                {
                    timeout: 7000
                },
                (response) => {

                    response.resume();

                    finish(
                        response.statusCode >= 200 &&
                        response.statusCode < 500
                    );
                }
            );

            request.on('error', () => {
                finish(false);
            });

            request.on('timeout', () => {

                request.destroy();

                finish(false);
            });

        } catch (error) {

            finish(false);
        }
    });
}

// ============================================================
// SPLASH
// ============================================================

function createSplash() {

    if (
        splashWindow &&
        !splashWindow.isDestroyed()
    ) {
        return;
    }

    splashWindow = new BrowserWindow({

        width: 500,
        height: 350,

        frame: false,
        resizable: false,
        movable: false,

        alwaysOnTop: true,

        backgroundColor: '#111111',

        webPreferences: {

            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    splashWindow.loadURL(`
        data:text/html;charset=utf-8,

        <!DOCTYPE html>

        <html>

        <head>

            <meta charset="UTF-8">

            <style>

                * {
                    box-sizing: border-box;
                }

                html,
                body {

                    margin: 0;

                    width: 100%;
                    height: 100%;

                    background: #111;

                    display: flex;

                    align-items: center;
                    justify-content: center;

                    overflow: hidden;

                    font-family: Arial, sans-serif;
                }

                .container {

                    text-align: center;
                }

                .logo {

                    font-size: 42px;

                    font-weight: bold;

                    color: white;

                    opacity: 0;

                    animation:
                        fadeIn 1.2s ease forwards,
                        pulse 2s ease-in-out infinite 1.2s;
                }

                .text {

                    margin-top: 18px;

                    color: #aaa;

                    font-size: 15px;

                    opacity: 0;

                    animation:
                        fadeText 1s ease 0.8s forwards;
                }

                .loader {

                    margin: 25px auto 0;

                    width: 34px;
                    height: 34px;

                    border: 3px solid #333;

                    border-top-color: white;

                    border-radius: 50%;

                    animation:
                        spin 0.8s linear infinite;
                }

                @keyframes fadeIn {

                    from {

                        opacity: 0;

                        transform:
                            scale(0.95);
                    }

                    to {

                        opacity: 1;

                        transform:
                            scale(1);
                    }
                }

                @keyframes fadeText {

                    from {
                        opacity: 0;
                    }

                    to {
                        opacity: 1;
                    }
                }

                @keyframes pulse {

                    0%,
                    100% {
                        opacity: 1;
                    }

                    50% {
                        opacity: 0.7;
                    }
                }

                @keyframes spin {

                    to {
                        transform:
                            rotate(360deg);
                    }
                }

            </style>

        </head>

        <body>

            <div class="container">

                <div class="logo">
                    ITLAB STORE
                </div>

                <div class="text">
                    Запуск магазина...
                </div>

                <div class="loader"></div>

            </div>

        </body>

        </html>
    `);

    splashWindow.on('closed', () => {

        splashWindow = null;
    });
}

// ============================================================
// OFFLINE
// ============================================================

function createOfflineWindow() {

    if (
        offlineWindow &&
        !offlineWindow.isDestroyed()
    ) {

        offlineWindow.show();

        return;
    }

    offlineWindow = new BrowserWindow({

        width: 600,
        height: 400,

        frame: false,

        show: true,

        backgroundColor: '#111111',

        webPreferences: {

            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    offlineWindow.setFullScreen(true);
    offlineWindow.setKiosk(true);

    offlineWindow.loadURL(`
        data:text/html;charset=utf-8,

        <!DOCTYPE html>

        <html>

        <head>

            <meta charset="UTF-8">

            <style>

                * {
                    box-sizing: border-box;
                }

                html,
                body {

                    width: 100%;
                    height: 100%;

                    margin: 0;

                    background: #111;

                    color: white;

                    font-family: Arial, sans-serif;

                    display: flex;

                    align-items: center;

                    justify-content: center;

                    text-align: center;
                }

                .box {

                    max-width: 650px;

                    padding: 40px;
                }

                h1 {

                    font-size: 34px;

                    margin-bottom: 20px;
                }

                p {

                    color: #aaa;

                    font-size: 18px;

                    line-height: 1.6;
                }

                button {

                    margin-top: 25px;

                    padding: 14px 28px;

                    border: none;

                    border-radius: 8px;

                    background: white;

                    color: black;

                    font-size: 16px;

                    cursor: pointer;
                }

            </style>

        </head>

        <body>

            <div class="box">

                <h1>
                    Нет подключения к интернету
                </h1>

                <p>
                    Не удалось подключиться к магазину.
                    Проверьте подключение к интернету.
                </p>

                <button onclick="location.reload()">
                    Повторить
                </button>

            </div>

        </body>

        </html>
    `);

    offlineWindow.on('closed', () => {

        offlineWindow = null;
    });

    return offlineWindow;
}

// ============================================================
// ЗАКРЫТИЕ SPLASH
// ============================================================

function closeSplash() {

    if (
        splashWindow &&
        !splashWindow.isDestroyed()
    ) {

        splashWindow.close();

        splashWindow = null;
    }
}

// ============================================================
// МАГАЗИН
// ============================================================

async function createShopWindow() {

    log('');
    log('================================');
    log('ЗАПУСК МАГАЗИНА');
    log('================================');

    const online = await checkShopOnline();

    if (!online) {

        log('МАГАЗИН НЕДОСТУПЕН');

        closeSplash();

        createOfflineWindow();

        return;
    }

    if (
        offlineWindow &&
        !offlineWindow.isDestroyed()
    ) {

        offlineWindow.close();

        offlineWindow = null;
    }

    if (
        shopWindow &&
        !shopWindow.isDestroyed()
    ) {

        shopWindow.show();
        shopWindow.focus();

        return;
    }

    shopWindow = new BrowserWindow({

        width: 1280,
        height: 800,

        show: false,

        frame: false,

        backgroundColor: '#ffffff',

        webPreferences: {

            preload: path.join(
                __dirname,
                'preload.js'
            ),

            contextIsolation: true,

            nodeIntegration: false,

            sandbox: false
        }
    });

    // ========================================================
    // FULLSCREEN / KIOSK
    // ========================================================

    shopWindow.setFullScreen(true);

    shopWindow.setKiosk(true);

    // ========================================================
    // ЗАГРУЗКА
    // ========================================================

    shopWindow.loadURL(SHOP_URL);

    // ========================================================
    // ЗАГРУЗКА ЗАВЕРШЕНА
    // ========================================================

    shopWindow.webContents.once(
        'did-finish-load',
        () => {

            log('МАГАЗИН ЗАГРУЖЕН');

            setTimeout(() => {

                closeSplash();

                if (
                    shopWindow &&
                    !shopWindow.isDestroyed()
                ) {

                    shopWindow.show();

                    shopWindow.focus();
                }

            }, 700);
        }
    );

    // ========================================================
    // ОШИБКА ЗАГРУЗКИ
    // ========================================================

    shopWindow.webContents.on(
        'did-fail-load',
        (
            event,
            errorCode,
            errorDescription
        ) => {

            log(
                'Ошибка загрузки магазина: ' +
                errorDescription
            );

            if (
                shopWindow &&
                !shopWindow.isDestroyed()
            ) {

                shopWindow.loadURL(`
                    data:text/html;charset=utf-8,

                    <!DOCTYPE html>

                    <html>

                    <body style="
                        margin:0;
                        background:#111;
                        color:white;
                        font-family:Arial;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        height:100vh;
                        text-align:center;
                    ">

                    <div>

                        <h1>
                            Нет подключения
                        </h1>

                        <p>
                            Не удалось загрузить магазин.
                        </p>

                        <button
                            onclick="
                                location.href='${SHOP_URL}'
                            "
                            style="
                                padding:12px 25px;
                                font-size:16px;
                                cursor:pointer;
                            "
                        >
                            Повторить
                        </button>

                    </div>

                    </body>

                    </html>
                `);
            }
        }
    );

    shopWindow.on(
        'closed',
        () => {

            shopWindow = null;
        }
    );
}

// ============================================================
// PIN ОКНО
// ============================================================

function createPinWindow() {

    log('');
    log('================================');
    log('СОЗДАНИЕ PIN ОКНА');
    log('================================');

    // --------------------------------------------------------
    // Если уже существует
    // --------------------------------------------------------

    if (
        pinWindow &&
        !pinWindow.isDestroyed()
    ) {

        log('PIN окно уже существует');

        try {

            pinWindow.setAlwaysOnTop(
                true,
                'screen-saver'
            );

            pinWindow.setVisibleOnAllWorkspaces(
                true,
                {
                    visibleOnFullScreen: true
                }
            );

            pinWindow.show();

            pinWindow.focus();

            pinWindow.moveTop();

        } catch (error) {

            console.log(
                'Ошибка показа существующего PIN:',
                error
            );
        }

        return;
    }

    // --------------------------------------------------------
    // Создание
    // --------------------------------------------------------

    pinWindow = new BrowserWindow({

        width: 430,
        height: 540,

        minWidth: 430,
        maxWidth: 430,

        minHeight: 540,
        maxHeight: 540,

        show: false,

        frame: false,

        resizable: false,

        movable: true,

        center: true,

        alwaysOnTop: true,

        skipTaskbar: false,

        backgroundColor: '#111111',

        webPreferences: {

            contextIsolation: true,

            nodeIntegration: false,

            sandbox: true
        }
    });

    // --------------------------------------------------------
    // КРИТИЧЕСКИ ВАЖНО ДЛЯ MACOS + KIOSK
    // --------------------------------------------------------

    try {

        pinWindow.setAlwaysOnTop(
            true,
            'screen-saver'
        );

    } catch (error) {

        pinWindow.setAlwaysOnTop(
            true,
            'floating'
        );
    }

    try {

        pinWindow.setVisibleOnAllWorkspaces(
            true,
            {
                visibleOnFullScreen: true
            }
        );

    } catch (error) {

        console.log(
            'setVisibleOnAllWorkspaces:',
            error
        );
    }

    // --------------------------------------------------------
    // HTML PIN
    // --------------------------------------------------------

    const pinHTML = `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>ITLAB STORE</title>

<style>

* {
    box-sizing: border-box;
}

html,
body {

    margin: 0;

    width: 100%;
    height: 100%;

    background:
        radial-gradient(
            circle at top,
            #252525 0%,
            #111111 55%,
            #080808 100%
        );

    color: white;

    font-family:
        Arial,
        Helvetica,
        sans-serif;

    overflow: hidden;
}

body {

    display: flex;

    align-items: center;

    justify-content: center;
}

.window {

    width: 100%;

    height: 100%;

    padding: 35px;

    display: flex;

    flex-direction: column;

    align-items: center;

    justify-content: center;
}

.logo {

    font-size: 28px;

    font-weight: 800;

    letter-spacing: 2px;

    margin-bottom: 8px;
}

.subtitle {

    color: #888;

    font-size: 13px;

    margin-bottom: 35px;
}

.title {

    font-size: 22px;

    font-weight: 600;

    margin-bottom: 25px;
}

.dots {

    display: flex;

    gap: 12px;

    margin-bottom: 28px;
}

.dot {

    width: 13px;

    height: 13px;

    border-radius: 50%;

    border: 2px solid #555;

    transition: 0.15s;
}

.dot.active {

    background: white;

    border-color: white;

    transform: scale(1.08);
}

.keypad {

    width: 280px;

    display: grid;

    grid-template-columns:
        repeat(3, 1fr);

    gap: 10px;
}

button {

    height: 58px;

    border: 1px solid #333;

    border-radius: 12px;

    background: #1b1b1b;

    color: white;

    font-size: 20px;

    cursor: pointer;

    transition:
        background 0.12s,
        transform 0.12s;
}

button:hover {

    background: #292929;
}

button:active {

    transform: scale(0.94);

    background: #333;
}

.clear {

    color: #999;

    font-size: 15px;
}

.cancel {

    color: #999;

    font-size: 15px;
}

.error {

    height: 20px;

    margin-top: 15px;

    color: #ff6b6b;

    font-size: 13px;

    opacity: 0;

    transition: 0.2s;
}

.error.show {

    opacity: 1;
}

</style>

</head>

<body>

<div class="window">

    <div class="logo">
        ITLAB STORE
    </div>

    <div class="subtitle">
        ADMINISTRATION
    </div>

    <div class="title">
        Введите PIN-код
    </div>

    <div class="dots">

        <div class="dot" id="dot1"></div>
        <div class="dot" id="dot2"></div>
        <div class="dot" id="dot3"></div>
        <div class="dot" id="dot4"></div>

    </div>

    <div class="keypad">

        <button onclick="press('1')">1</button>
        <button onclick="press('2')">2</button>
        <button onclick="press('3')">3</button>

        <button onclick="press('4')">4</button>
        <button onclick="press('5')">5</button>
        <button onclick="press('6')">6</button>

        <button onclick="press('7')">7</button>
        <button onclick="press('8')">8</button>
        <button onclick="press('9')">9</button>

        <button
            class="clear"
            onclick="clearPin()"
        >
            Очистить
        </button>

        <button onclick="press('0')">
            0
        </button>

        <button
            class="cancel"
            onclick="cancel()"
        >
            Отмена
        </button>

    </div>

    <div
        class="error"
        id="error"
    >
        Неверный PIN-код
    </div>

</div>

<script>

let pin = '';

const correctPin = '${ADMIN_PIN}';

function updateDots() {

    for (
        let i = 1;
        i <= 4;
        i++
    ) {

        const dot =
            document.getElementById(
                'dot' + i
            );

        if (i <= pin.length) {

            dot.classList.add(
                'active'
            );

        } else {

            dot.classList.remove(
                'active'
            );
        }
    }
}

function press(number) {

    if (pin.length >= 4) {
        return;
    }

    pin += number;

    updateDots();

    if (pin.length === 4) {

        setTimeout(() => {

            if (pin === correctPin) {

                document.body.style.opacity =
                    '0';

                document.body.style.transition =
                    'opacity 0.15s';

                setTimeout(() => {

                    window.electronAPI
                        .pinSuccess();

                }, 150);

            } else {

                const error =
                    document.getElementById(
                        'error'
                    );

                error.classList.add(
                    'show'
                );

                setTimeout(() => {

                    pin = '';

                    updateDots();

                    error.classList.remove(
                        'show'
                    );

                }, 700);
            }

        }, 100);
    }
}

function clearPin() {

    pin = '';

    updateDots();

    document
        .getElementById('error')
        .classList.remove('show');
}

function cancel() {

    window.electronAPI
        .closePin();
}

document.addEventListener(
    'keydown',
    (event) => {

        if (
            event.key >= '0' &&
            event.key <= '9'
        ) {

            press(event.key);
        }

        if (event.key === 'Escape') {

            cancel();
        }

        if (
            event.key === 'Backspace'
        ) {

            pin =
                pin.slice(
                    0,
                    -1
                );

            updateDots();
        }
    }
);

</script>

</body>

</html>

`;

    // --------------------------------------------------------
    // PRELOAD ДЛЯ PIN
    // --------------------------------------------------------

    const pinPreloadPath =
        path.join(
            app.getPath('temp'),
            'itlab-pin-preload.js'
        );

    const fs = require('fs');

    try {

        fs.writeFileSync(
            pinPreloadPath,

            `
const {
    contextBridge,
    ipcRenderer
} = require('electron');

contextBridge.exposeInMainWorld(
    'electronAPI',
    {

        pinSuccess: () => {
            ipcRenderer.send(
                'pin-success'
            );
        },

        closePin: () => {
            ipcRenderer.send(
                'pin-close'
            );
        }

    }
);
`
        );

    } catch (error) {

        console.log(
            'Ошибка создания PIN preload:',
            error
        );
    }

    // --------------------------------------------------------
    // Пересоздаём webContents с preload нельзя после создания,
    // поэтому загружаем HTML через data URL и используем IPC
    // через разрешённый preload.
    // --------------------------------------------------------

    pinWindow.destroy();

    pinWindow = new BrowserWindow({

        width: 430,
        height: 540,

        minWidth: 430,
        maxWidth: 430,

        minHeight: 540,
        maxHeight: 540,

        show: false,

        frame: false,

        resizable: false,

        movable: true,

        center: true,

        alwaysOnTop: true,

        skipTaskbar: false,

        backgroundColor: '#111111',

        webPreferences: {

            preload: pinPreloadPath,

            contextIsolation: true,

            nodeIntegration: false,

            sandbox: false
        }
    });

    try {

        pinWindow.setAlwaysOnTop(
            true,
            'screen-saver'
        );

    } catch (error) {

        pinWindow.setAlwaysOnTop(
            true,
            'floating'
        );
    }

    try {

        pinWindow.setVisibleOnAllWorkspaces(
            true,
            {
                visibleOnFullScreen: true
            }
        );

    } catch (error) {}

    pinWindow.loadURL(
        'data:text/html;charset=utf-8,' +
        encodeURIComponent(pinHTML)
    );

    pinWindow.once(
        'ready-to-show',
        () => {

            log('PIN ОКНО ГОТОВО');

            if (
                !pinWindow ||
                pinWindow.isDestroyed()
            ) {
                return;
            }

            try {

                pinWindow.setAlwaysOnTop(
                    true,
                    'screen-saver'
                );

            } catch (error) {

                pinWindow.setAlwaysOnTop(
                    true,
                    'floating'
                );
            }

            try {

                pinWindow.setVisibleOnAllWorkspaces(
                    true,
                    {
                        visibleOnFullScreen: true
                    }
                );

            } catch (error) {}

            pinWindow.center();

            pinWindow.show();

            pinWindow.focus();

            try {
                pinWindow.moveTop();
            } catch (error) {}

            // Повторно через 300 мс
            setTimeout(() => {

                if (
                    !pinWindow ||
                    pinWindow.isDestroyed()
                ) {
                    return;
                }

                try {

                    pinWindow.setAlwaysOnTop(
                        true,
                        'screen-saver'
                    );

                } catch (error) {}

                pinWindow.show();

                pinWindow.focus();

                try {
                    pinWindow.moveTop();
                } catch (error) {}

            }, 300);

            // И ещё раз
            setTimeout(() => {

                if (
                    !pinWindow ||
                    pinWindow.isDestroyed()
                ) {
                    return;
                }

                pinWindow.show();

                pinWindow.focus();

                try {
                    pinWindow.moveTop();
                } catch (error) {}

            }, 1000);
        }
    );

    pinWindow.on(
        'closed',
        () => {

            log('PIN ОКНО ЗАКРЫТО');

            pinWindow = null;
        }
    );
}

// ============================================================
// АДМИНКА
// ============================================================

function createAdminWindow() {

    log('');
    log('================================');
    log('ОТКРЫТИЕ АДМИН-ПАНЕЛИ');
    log('================================');

    if (
        adminWindow &&
        !adminWindow.isDestroyed()
    ) {

        log('АДМИНКА УЖЕ ОТКРЫТА');

        try {

            adminWindow.setAlwaysOnTop(
                true,
                'screen-saver'
            );

            adminWindow.show();

            adminWindow.focus();

            adminWindow.moveTop();

        } catch (error) {

            console.log(error);
        }

        return;
    }

    const primaryDisplay =
        screen.getPrimaryDisplay();

    const {
        width,
        height
    } = primaryDisplay.workAreaSize;

    adminWindow = new BrowserWindow({

        width: 900,
        height: 650,

        minWidth: 700,
        minHeight: 500,

        show: false,

        frame: true,

        title:
            'ITLAB STORE — Админ-панель',

        backgroundColor: '#111111',

        resizable: true,

        movable: true,

        alwaysOnTop: true,

        skipTaskbar: false,

        webPreferences: {

            preload:
                path.join(
                    __dirname,
                    'preload.js'
                ),

            contextIsolation: true,

            nodeIntegration: false,

            sandbox: false
        }
    });

    // --------------------------------------------------------
    // ПОВЕРХ KIOSK
    // --------------------------------------------------------

    try {

        adminWindow.setAlwaysOnTop(
            true,
            'screen-saver'
        );

    } catch (error) {

        adminWindow.setAlwaysOnTop(
            true,
            'floating'
        );
    }

    try {

        adminWindow.setVisibleOnAllWorkspaces(
            true,
            {
                visibleOnFullScreen: true
            }
        );

    } catch (error) {}

    adminWindow.setPosition(
        Math.round(
            (width - 900) / 2
        ),
        Math.round(
            (height - 650) / 2
        )
    );

    // --------------------------------------------------------
    // ЗАГРУЗКА ADMIN.HTML
    // --------------------------------------------------------

    adminWindow.loadFile(
        path.join(
            __dirname,
            'admin.html'
        )
    );

    adminWindow.once(
        'ready-to-show',
        () => {

            if (
                !adminWindow ||
                adminWindow.isDestroyed()
            ) {
                return;
            }

            adminWindow.show();

            try {

                adminWindow.setAlwaysOnTop(
                    true,
                    'screen-saver'
                );

            } catch (error) {}

            adminWindow.focus();

            try {
                adminWindow.moveTop();
            } catch (error) {}

            setTimeout(() => {

                if (
                    !adminWindow ||
                    adminWindow.isDestroyed()
                ) {
                    return;
                }

                adminWindow.show();

                adminWindow.focus();

                try {
                    adminWindow.moveTop();
                } catch (error) {}

            }, 300);
        }
    );

    adminWindow.on(
        'closed',
        () => {

            adminWindow = null;
        }
    );
}

// ============================================================
// ГОРЯЧАЯ КЛАВИША
// ============================================================

function registerAdminShortcut() {

    // --------------------------------------------------------
    // macOS
    // --------------------------------------------------------

    if (process.platform === 'darwin') {

        const macRegistered =
            globalShortcut.register(
                'Command+Shift+A',
                () => {

                    log('');
                    log('================================');
                    log('ГОРЯЧАЯ КЛАВИША НАЖАТА');
                    log('ОТКРЫТИЕ PIN ОКНА');
                    log('================================');

                    createPinWindow();
                }
            );

        if (macRegistered) {

            log(
                'Горячая клавиша: ' +
                'Command+Shift+A ЗАРЕГИСТРИРОВАНА'
            );

        } else {

            log(
                'ОШИБКА: Command+Shift+A НЕ ЗАРЕГИСТРИРОВАНА'
            );
        }

        return;
    }

    // --------------------------------------------------------
    // Windows / Linux
    // --------------------------------------------------------

    const registered =
        globalShortcut.register(
            'Control+Shift+A',
            () => {

                log('');
                log('================================');
                log('ГОРЯЧАЯ КЛАВИША НАЖАТА');
                log('ОТКРЫТИЕ PIN ОКНА');
                log('================================');

                createPinWindow();
            }
        );

    if (registered) {

        log(
            'Горячая клавиша: ' +
            'Control+Shift+A ЗАРЕГИСТРИРОВАНА'
        );

    } else {

        log(
            'ОШИБКА: Control+Shift+A НЕ ЗАРЕГИСТРИРОВАНА'
        );
    }
}

// ============================================================
// IPC — PIN УСПЕШЕН
// ============================================================

ipcMain.on(
    'pin-success',
    () => {

        log('');
        log('================================');
        log('PIN ПРАВИЛЬНЫЙ');
        log('ОТКРЫВАЕМ АДМИНКУ');
        log('================================');

        if (
            pinWindow &&
            !pinWindow.isDestroyed()
        ) {

            pinWindow.close();

            pinWindow = null;
        }

        setTimeout(() => {

            createAdminWindow();

        }, 150);
    }
);

// ============================================================
// IPC — ЗАКРЫТЬ PIN
// ============================================================

ipcMain.on(
    'pin-close',
    () => {

        log('ЗАКРЫТИЕ PIN');

        if (
            pinWindow &&
            !pinWindow.isDestroyed()
        ) {

            pinWindow.close();
        }
    }
);

// ============================================================
// IPC — ПОЛУЧИТЬ IP
// ============================================================

ipcMain.handle(
    'get-local-ip',
    () => {

        return getMainIP();
    }
);

// ============================================================
// IPC — ВСЕ IP
// ============================================================

ipcMain.handle(
    'get-all-local-ips',
    () => {

        return getLocalIPs();
    }
);

// ============================================================
// IPC — ОТКРЫТЬ МАГАЗИН
// ============================================================

ipcMain.on(
    'admin-open-shop',
    () => {

        if (
            shopWindow &&
            !shopWindow.isDestroyed()
        ) {

            shopWindow.show();

            shopWindow.focus();

            return;
        }

        createShopWindow();
    }
);

// ============================================================
// IPC — ПЕРЕЗАГРУЗИТЬ МАГАЗИН
// ============================================================

ipcMain.on(
    'admin-reload-shop',
    () => {

        log('ПЕРЕЗАГРУЗКА МАГАЗИНА');

        if (
            shopWindow &&
            !shopWindow.isDestroyed()
        ) {

            shopWindow.webContents.reload();

            shopWindow.show();

            shopWindow.focus();

            return;
        }

        createShopWindow();
    }
);

// ============================================================
// IPC — ПЕРЕЗАПУСТИТЬ ПРИЛОЖЕНИЕ
// ============================================================

ipcMain.on(
    'admin-restart-app',
    () => {

        log('ПЕРЕЗАПУСК ПРИЛОЖЕНИЯ');

        app.relaunch();

        app.exit(0);
    }
);

// ============================================================
// IPC — ЗАКРЫТЬ АДМИНКУ
// ============================================================

ipcMain.on(
    'admin-close',
    () => {

        if (
            adminWindow &&
            !adminWindow.isDestroyed()
        ) {

            adminWindow.close();
        }
    }
);

// ============================================================
// IPC — СТАТУС
// ============================================================

ipcMain.handle(
    'get-shop-status',
    () => {

        return {

            online:
                !!(
                    shopWindow &&
                    !shopWindow.isDestroyed()
                ),

            ip:
                getMainIP()
        };
    }
);

// ============================================================
// IPC — ПОЛУЧИТЬ СТАТУС ПРИЛОЖЕНИЯ
// ============================================================

ipcMain.handle(
    'get-app-info',
    () => {

        return {

            version:
                app.getVersion(),

            platform:
                process.platform,

            ip:
                getMainIP(),

            shop:
                SHOP_URL
        };
    }
);

// ============================================================
// APP READY
// ============================================================

app.whenReady().then(
    async () => {

        log('');
        log('================================');
        log('ITLAB KIOSK ЗАПУЩЕН');
        log('================================');

        // ----------------------------------------------------
        // Splash
        // ----------------------------------------------------

        createSplash();

        // ----------------------------------------------------
        // Горячая клавиша
        // ----------------------------------------------------

        registerAdminShortcut();

        // ----------------------------------------------------
        // Магазин
        // ----------------------------------------------------

        await createShopWindow();
    }
);

// ============================================================
// MACOS ACTIVATE
// ============================================================

app.on(
    'activate',
    () => {

        if (
            !shopWindow ||
            shopWindow.isDestroyed()
        ) {

            createShopWindow();

            return;
        }

        shopWindow.show();

        shopWindow.focus();
    }
);

// ============================================================
// ВСЕ ОКНА ЗАКРЫТЫ
// ============================================================

app.on(
    'window-all-closed',
    () => {

        if (
            process.platform !== 'darwin'
        ) {

            app.quit();
        }
    }
);

// ============================================================
// WILL QUIT
// ============================================================

app.on(
    'will-quit',
    () => {

        globalShortcut.unregisterAll();
    }
);

// ============================================================
// APP BEFORE QUIT
// ============================================================

app.on(
    'before-quit',
    () => {

        globalShortcut.unregisterAll();
    }
);