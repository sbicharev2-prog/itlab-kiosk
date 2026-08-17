const {
    app,
    BrowserWindow,
    globalShortcut,
    ipcMain,
    screen
} = require('electron');

const {
    autoUpdater
} = require('electron-updater');

const https = require('https');
const http = require('http');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// ============================================================
// WINDOWS TASKBAR CONTROL
// ============================================================

function hideWindowsTaskbar() {

    if (process.platform !== 'win32') {
        return;
    }

    exec(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$code = '[DllImport(\\\"user32.dll\\\")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName); [DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);'; Add-Type -MemberDefinition $code -Name Win32 -Namespace Taskbar; $h = [Taskbar.Win32]::FindWindow('Shell_TrayWnd', ''); if ($h -ne [IntPtr]::Zero) { [Taskbar.Win32]::ShowWindow($h, 0) }"`,
        () => {}
    );
}

function showWindowsTaskbar() {

    if (process.platform !== 'win32') {
        return;
    }

    exec(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$code = '[DllImport(\\\"user32.dll\\\")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName); [DllImport(\\\"user32.dll\\\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);'; Add-Type -MemberDefinition $code -Name Win32 -Namespace Taskbar; $h = [Taskbar.Win32]::FindWindow('Shell_TrayWnd', ''); if ($h -ne [IntPtr]::Zero) { [Taskbar.Win32]::ShowWindow($h, 5) }"`,
        () => {}
    );
}

// ============================================================
// НАСТРОЙКИ
// ============================================================

const SHOP_URL = 'https://sklep.itlabstore.pl/';
const REMOTE_PORT = 3000;

// ============================================================
// PIN
// ============================================================

const ADMIN_PIN = '0808';

// ============================================================
// VARIABLES
// ============================================================

const startTime = Date.now();

let win = null;
let pinWindow = null;
let adminWindow = null;

let currentPage = 'loader';

let lastInternetCheck = null;
let checkingInternet = false;

let historyFile = null;
let browsingHistory = [];

let applicationLogs = [];

let remoteServer = null;
let remoteTokens = new Set();

// ============================================================
// UPDATE VARIABLES
// ============================================================

let updateInfo = null;
let updateDownloaded = false;
let updateDownloading = false;
let updateDownloadProgress = 0;
let updateError = null;

// ============================================================
// LOG
// ============================================================

function addLog(message, type = 'info') {

    const item = {
        time: new Date().toISOString(),
        type,
        message
    };

    applicationLogs.unshift(item);

    if (applicationLogs.length > 1000) {
        applicationLogs =
            applicationLogs.slice(0, 1000);
    }

    console.log(
        `[${type.toUpperCase()}] ${message}`
    );
}

// ============================================================
// AUTO UPDATE CONFIGURATION
// ============================================================

function setupAutoUpdater() {

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on(
        'checking-for-update',
        () => {

            updateError = null;

            addLog(
                'Checking for application updates...',
                'update'
            );

            sendUpdateStatus();
        }
    );

    autoUpdater.on(
        'update-available',
        (info) => {

            updateInfo = info;

            updateDownloaded = false;
            updateDownloading = false;
            updateDownloadProgress = 0;
            updateError = null;

            addLog(
                `Update available: ${info.version}`,
                'success'
            );

            sendUpdateStatus();
        }
    );

    autoUpdater.on(
        'update-not-available',
        (info) => {

            updateInfo = null;

            updateDownloaded = false;
            updateDownloading = false;
            updateDownloadProgress = 0;
            updateError = null;

            addLog(
                `Application is up to date: ${info.version}`,
                'success'
            );

            sendUpdateStatus();
        }
    );

    autoUpdater.on(
        'download-progress',
        (progress) => {

            updateDownloading = true;

            updateDownloadProgress =
                Math.round(
                    progress.percent || 0
                );

            sendUpdateStatus();
        }
    );

    autoUpdater.on(
        'update-downloaded',
        (info) => {

            updateInfo = info;

            updateDownloaded = true;
            updateDownloading = false;
            updateDownloadProgress = 100;
            updateError = null;

            addLog(
                `Update downloaded: ${info.version}`,
                'success'
            );

            sendUpdateStatus();
        }
    );

    autoUpdater.on(
        'error',
        (error) => {

            updateDownloading = false;

            updateError =
                error &&
                error.message
                    ? error.message
                    : String(error);

            addLog(
                'Update error: ' + updateError,
                'error'
            );

            sendUpdateStatus();
        }
    );
}

// ============================================================
// UPDATE STATUS
// ============================================================

function getUpdateStatus() {

    return {

        currentVersion:
            app.getVersion(),

        availableVersion:
            updateInfo
                ? updateInfo.version
                : null,

        releaseName:
            updateInfo
                ? updateInfo.releaseName || null
                : null,

        releaseNotes:
            updateInfo
                ? updateInfo.releaseNotes || null
                : null,

        updateAvailable:
            !!updateInfo,

        updateDownloaded,

        downloading:
            updateDownloading,

        progress:
            updateDownloadProgress,

        error:
            updateError
    };
}

// ============================================================
// SEND UPDATE STATUS
// ============================================================

function sendUpdateStatus() {

    if (
        adminWindow &&
        !adminWindow.isDestroyed()
    ) {

        adminWindow.webContents.send(
            'update-status',
            getUpdateStatus()
        );
    }
}

// ============================================================
// CHECK FOR UPDATES
// ============================================================

async function checkForUpdates() {

    if (!app.isPackaged) {

        addLog(
            'Update check skipped in development mode',
            'warning'
        );

        sendUpdateStatus();

        return {
            success: false,
            development: true,
            message:
                'Aktualizacje są dostępne tylko w gotowej aplikacji.'
        };
    }

    try {

        updateError = null;

        sendUpdateStatus();

        const result =
            await autoUpdater.checkForUpdates();

        return {
            success: true,

            update:
                result &&
                result.updateInfo
                    ? result.updateInfo
                    : null,

            status:
                getUpdateStatus()
        };

    } catch (error) {

        updateError =
            error &&
            error.message
                ? error.message
                : String(error);

        addLog(
            'Update check failed: ' +
            updateError,
            'error'
        );

        sendUpdateStatus();

        return {
            success: false,
            error:
                updateError
        };
    }
}

// ============================================================
// DOWNLOAD UPDATE
// ============================================================

async function downloadUpdate() {

    if (!app.isPackaged) {

        return {
            success: false,

            error:
                'Aktualizacje są dostępne tylko w gotowej aplikacji.'
        };
    }

    if (updateDownloaded) {

        return {
            success: true,
            downloaded: true
        };
    }

    if (updateDownloading) {

        return {
            success: true,
            downloading: true,
            progress:
                updateDownloadProgress
        };
    }

    try {

        updateError = null;
        updateDownloading = true;
        updateDownloadProgress = 0;

        sendUpdateStatus();

        await autoUpdater.downloadUpdate();

        return {
            success: true
        };

    } catch (error) {

        updateDownloading = false;

        updateError =
            error &&
            error.message
                ? error.message
                : String(error);

        addLog(
            'Update download failed: ' +
            updateError,
            'error'
        );

        sendUpdateStatus();

        return {
            success: false,
            error:
                updateError
        };
    }
}

// ============================================================
// INSTALL UPDATE
// ============================================================

function installUpdate() {

    if (!updateDownloaded) {

        return {
            success: false,

            error:
                'Aktualizacja nie została jeszcze pobrana.'
        };
    }

    addLog(
        'Installing downloaded update...',
        'update'
    );

    setTimeout(
        () => {

            try {

                autoUpdater.quitAndInstall(
                    false,
                    true
                );

            } catch (error) {

                addLog(
                    'Install update error: ' +
                    error.message,
                    'error'
                );
            }

        },
        300
    );

    return {
        success: true
    };
}

// ============================================================
// HISTORY
// ============================================================

function initHistory() {

    historyFile =
        path.join(
            app.getPath('userData'),
            'history.json'
        );

    try {

        if (
            fs.existsSync(historyFile)
        ) {

            const data =
                fs.readFileSync(
                    historyFile,
                    'utf8'
                );

            browsingHistory =
                JSON.parse(data);

            if (
                !Array.isArray(
                    browsingHistory
                )
            ) {

                browsingHistory = [];
            }

        } else {

            browsingHistory = [];

            saveHistory();
        }

    } catch (error) {

        addLog(
            'History read error: ' +
            error.message,
            'error'
        );

        browsingHistory = [];
    }
}

// ============================================================
// SAVE HISTORY
// ============================================================

function saveHistory() {

    try {

        if (!historyFile) {
            return;
        }

        fs.writeFileSync(
            historyFile,
            JSON.stringify(
                browsingHistory,
                null,
                2
            ),
            'utf8'
        );

    } catch (error) {

        addLog(
            'History save error: ' +
            error.message,
            'error'
        );
    }
}

// ============================================================
// ADD HISTORY
// ============================================================

async function addHistory(url) {

    if (!url) {
        return;
    }

    if (!url.startsWith(SHOP_URL)) {
        return;
    }

    if (
        url === SHOP_URL ||
        url === 'https://sklep.itlabstore.pl'
    ) {

        return;
    }

    let title = 'Produkt';

    try {

        if (
            win &&
            !win.isDestroyed()
        ) {

            title =
                await win.webContents
                    .executeJavaScript(
                        'document.title',
                        true
                    );
        }

    } catch (error) {

        addLog(
            'Cannot get page title',
            'warning'
        );
    }

    if (
        !title ||
        title.trim() === ''
    ) {

        title = 'Produkt';
    }

    const item = {

        id:
            Date.now() +
            '-' +
            Math.random()
                .toString(36)
                .substring(2, 8),

        title:
            title.trim(),

        url,

        time:
            new Date().toISOString()
    };

    browsingHistory.unshift(
        item
    );

    if (
        browsingHistory.length > 5000
    ) {

        browsingHistory =
            browsingHistory.slice(
                0,
                5000
            );
    }

    saveHistory();

    addLog(
        `Otworzono produkt: ${item.title}`,
        'history'
    );
}

// ============================================================
// INTERNET
// ============================================================

function checkInternet() {

    return new Promise(
        (resolve) => {

            const request =
                https.get(
                    SHOP_URL,
                    (response) => {

                        response.destroy();

                        lastInternetCheck =
                            new Date();

                        resolve(true);
                    }
                );

            request.on(
                'error',
                () => {

                    lastInternetCheck =
                        new Date();

                    resolve(false);
                }
            );

            request.setTimeout(
                5000,
                () => {

                    request.destroy();

                    lastInternetCheck =
                        new Date();

                    resolve(false);
                }
            );
        }
    );
}

// ============================================================
// LOCAL IP
// ============================================================

function getLocalIPv4Addresses() {

    const interfaces =
        os.networkInterfaces();

    const addresses = [];

    for (
        const name of Object.keys(
            interfaces
        )
    ) {

        for (
            const network of
            interfaces[name] || []
        ) {

            if (
                network.family === 'IPv4' &&
                !network.internal
            ) {

                addresses.push(
                    network.address
                );
            }
        }
    }

    return addresses;
}

// ============================================================
// JSON
// ============================================================

function sendJson(
    res,
    status,
    data
) {

    const body =
        JSON.stringify(data);

    res.writeHead(
        status,
        {
            'Content-Type':
                'application/json; charset=utf-8',

            'Content-Length':
                Buffer.byteLength(body),

            'Access-Control-Allow-Origin':
                '*',

            'Cache-Control':
                'no-store'
        }
    );

    res.end(body);
}

// ============================================================
// HTML
// ============================================================

function sendHtml(
    res,
    html
) {

    res.writeHead(
        200,
        {
            'Content-Type':
                'text/html; charset=utf-8',

            'Cache-Control':
                'no-store'
        }
    );

    res.end(html);
}

// ============================================================
// BODY
// ============================================================

function readRequestBody(req) {

    return new Promise(
        (resolve, reject) => {

            let body = '';

            req.on(
                'data',
                (chunk) => {

                    body += chunk;

                    if (
                        body.length >
                        1024 * 1024
                    ) {

                        reject(
                            new Error(
                                'Request too large'
                            )
                        );

                        req.destroy();
                    }
                }
            );

            req.on(
                'end',
                () => {

                    if (!body) {

                        resolve({});

                        return;
                    }

                    try {

                        resolve(
                            JSON.parse(body)
                        );

                    } catch (error) {

                        reject(error);
                    }
                }
            );

            req.on(
                'error',
                reject
            );
        }
    );
}

// ============================================================
// AUTH
// ============================================================

function isAuthorized(req) {

    const token =
        req.headers['x-admin-token'];

    if (!token) {
        return false;
    }

    return remoteTokens.has(token);
}

// ============================================================
// REMOTE SERVER
// ============================================================

function startRemoteServer() {

    if (remoteServer) {
        return;
    }

    remoteServer =
        http.createServer(
            async (req, res) => {

                try {

                    await handleRemoteRequest(
                        req,
                        res
                    );

                } catch (error) {

                    addLog(
                        'Remote server error: ' +
                        error.message,
                        'error'
                    );

                    sendJson(
                        res,
                        500,
                        {
                            success: false,
                            error: 'Server error'
                        }
                    );
                }
            }
        );

    remoteServer.listen(
        REMOTE_PORT,
        '0.0.0.0',
        () => {

            const addresses =
                getLocalIPv4Addresses();

            addLog(
                `Remote control started on port ${REMOTE_PORT}`,
                'remote'
            );

            console.log('');
            console.log(
                '=============================================='
            );
            console.log(
                ' ITLab Store Remote Control'
            );
            console.log(
                '=============================================='
            );

            addresses.forEach(
                (ip) => {

                    console.log(
                        `http://${ip}:${REMOTE_PORT}`
                    );
                }
            );

            console.log(
                '=============================================='
            );

            console.log('');
        }
    );

    remoteServer.on(
        'error',
        (error) => {

            addLog(
                'Remote server failed: ' +
                error.message,
                'error'
            );
        }
    );
}

// ============================================================
// STOP REMOTE
// ============================================================

function stopRemoteServer() {

    if (!remoteServer) {
        return;
    }

    try {

        remoteServer.close();

    } catch (error) {

        console.log(error);
    }

    remoteServer = null;
}

// ============================================================
// REMOTE REQUEST
// ============================================================

async function handleRemoteRequest(
    req,
    res
) {

    const url =
        new URL(
            req.url,
            `http://${req.headers.host || 'localhost'}`
        );

    if (
        req.method === 'OPTIONS'
    ) {

        res.writeHead(
            204,
            {
                'Access-Control-Allow-Origin': '*',

                'Access-Control-Allow-Headers':
                    'Content-Type, X-Admin-Token',

                'Access-Control-Allow-Methods':
                    'GET, POST, OPTIONS'
            }
        );

        res.end();

        return;
    }

    // ========================================================
    // REMOTE ADMIN
    // ========================================================

    if (
        req.method === 'GET' &&
        (
            url.pathname === '/' ||
            url.pathname === '/admin'
        )
    ) {

        const adminPath =
            path.join(
                __dirname,
                'src',
                'admin.html'
            );

        if (
            !fs.existsSync(adminPath)
        ) {

            sendJson(
                res,
                404,
                {
                    success: false,
                    error:
                        'admin.html not found'
                }
            );

            return;
        }

        const html =
            fs.readFileSync(
                adminPath,
                'utf8'
            );

        sendHtml(
            res,
            html
        );

        return;
    }

    // ========================================================
    // LOGIN
    // ========================================================

    if (
        req.method === 'POST' &&
        url.pathname === '/api/login'
    ) {

        const body =
            await readRequestBody(req);

        if (
            String(
                body.password || ''
            ) !== ADMIN_PIN
        ) {

            addLog(
                'Remote login failed',
                'warning'
            );

            sendJson(
                res,
                401,
                {
                    success: false,
                    error:
                        'Nieprawidłowe hasło'
                }
            );

            return;
        }

        const token =
            crypto
                .randomBytes(32)
                .toString('hex');

        remoteTokens.add(token);

        addLog(
            'Remote admin login successful',
            'remote'
        );

        sendJson(
            res,
            200,
            {
                success: true,
                token
            }
        );

        return;
    }

    // ========================================================
    // LOGOUT
    // ========================================================

    if (
        req.method === 'POST' &&
        url.pathname === '/api/logout'
    ) {

        const token =
            req.headers['x-admin-token'];

        if (token) {
            remoteTokens.delete(token);
        }

        sendJson(
            res,
            200,
            {
                success: true
            }
        );

        return;
    }

    // ========================================================
    // PROTECTED API
    // ========================================================

    if (
        url.pathname.startsWith('/api/')
    ) {

        if (
            !isAuthorized(req)
        ) {

            sendJson(
                res,
                401,
                {
                    success: false,
                    error: 'Unauthorized'
                }
            );

            return;
        }
    }

    // ========================================================
    // STATUS
    // ========================================================

    if (
        req.method === 'GET' &&
        url.pathname === '/api/status'
    ) {

        const internet =
            await checkInternet();

        const uptimeSeconds =
            Math.floor(
                (
                    Date.now() -
                    startTime
                ) / 1000
            );

        const hours =
            Math.floor(
                uptimeSeconds / 3600
            );

        const minutes =
            Math.floor(
                (
                    uptimeSeconds %
                    3600
                ) / 60
            );

        const seconds =
            uptimeSeconds % 60;

        sendJson(
            res,
            200,
            {
                success: true,

                internet,

                page:
                    currentPage,

                kiosk:
                    win &&
                    !win.isDestroyed()
                        ? win.isKiosk()
                        : false,

                uptime:
                    `${hours}h ${minutes}m ${seconds}s`,

                historyCount:
                    browsingHistory.length,

                lastCheck:
                    lastInternetCheck
                        ? lastInternetCheck
                            .toLocaleTimeString(
                                'pl-PL'
                            )
                        : 'Brak danych',

                localIPs:
                    getLocalIPv4Addresses(),

                port:
                    REMOTE_PORT,

                appVersion:
                    app.getVersion()
            }
        );

        return;
    }

    // ========================================================
    // UPDATE STATUS
    // ========================================================

    if (
        req.method === 'GET' &&
        url.pathname === '/api/update-status'
    ) {

        sendJson(
            res,
            200,
            {
                success: true,
                update:
                    getUpdateStatus()
            }
        );

        return;
    }

    // ========================================================
    // CHECK UPDATE
    // ========================================================

    if (
        req.method === 'POST' &&
        url.pathname === '/api/check-update'
    ) {

        const result =
            await checkForUpdates();

        sendJson(
            res,
            200,
            result
        );

        return;
    }

    // ========================================================
    // DOWNLOAD UPDATE
    // ========================================================

    if (
        req.method === 'POST' &&
        url.pathname === '/api/download-update'
    ) {

        const result =
            await downloadUpdate();

        sendJson(
            res,
            200,
            result
        );

        return;
    }

    // ========================================================
    // INSTALL UPDATE
    // ========================================================

    if (
        req.method === 'POST' &&
        url.pathname === '/api/install-update'
    ) {

        const result =
            installUpdate();

        sendJson(
            res,
            200,
            result
        );

        return;
    }

    // ========================================================
    // CHECK INTERNET
    // ========================================================

    if (
        req.method === 'POST' &&
        url.pathname === '/api/check-internet'
    ) {

        const result =
            await checkInternet();

        sendJson(
            res,
            200,
            {
                success: true,
                internet: result
            }
        );

        return;
    }

    // ========================================================
    // OPEN SHOP
    // ========================================================

    if (
        req.method === 'POST' &&
        url.pathname === '/api/open-shop'
    ) {

        openShop();

        sendJson(
            res,
            200,
            {
                success: true
            }
        );

        return;
    }

    // ========================================================
    // RELOAD SHOP
    // ========================================================

    if (
        req.method === 'POST' &&
        url.pathname === '/api/reload-shop'
    ) {

        if (
            win &&
            !win.isDestroyed()
        ) {

            addLog(
                'Remote admin reloaded shop',
                'remote'
            );

            win.reload();
        }

        sendJson(
            res,
            200,
            {
                success: true
            }
        );

        return;
    }

    // ========================================================
    // ENABLE KIOSK
    // ========================================================

    if (
        req.method === 'POST' &&
        url.pathname === '/api/enable-kiosk'
    ) {

        enableKiosk();

        sendJson(
            res,
            200,
            {
                success: true
            }
        );

        return;
    }

    // ========================================================
    // DISABLE KIOSK
    // ========================================================

    if (
        req.method === 'POST' &&
        url.pathname === '/api/disable-kiosk'
    ) {

        disableKiosk();

        sendJson(
            res,
            200,
            {
                success: true
            }
        );

        return;
    }

    // ========================================================
    // RESTART
    // ========================================================

    if (
        req.method === 'POST' &&
        url.pathname === '/api/restart-kiosk'
    ) {

        restartKiosk();

        sendJson(
            res,
            200,
            {
                success: true
            }
        );

        return;
    }

    // ========================================================
    // HISTORY
    // ========================================================

    if (
        req.method === 'GET' &&
        url.pathname === '/api/history'
    ) {

        sendJson(
            res,
            200,
            {
                success: true,
                history:
                    browsingHistory
            }
        );

        return;
    }

    // ========================================================
    // CLEAR HISTORY
    // ========================================================

    if (
        req.method === 'POST' &&
        url.pathname === '/api/clear-history'
    ) {

        browsingHistory = [];

        saveHistory();

        addLog(
            'Remote admin cleared history',
            'remote'
        );

        sendJson(
            res,
            200,
            {
                success: true
            }
        );

        return;
    }

    // ========================================================
    // LOGS
    // ========================================================

    if (
        req.method === 'GET' &&
        url.pathname === '/api/logs'
    ) {

        sendJson(
            res,
            200,
            {
                success: true,
                logs:
                    applicationLogs
            }
        );

        return;
    }

    // ========================================================
    // SYSTEM
    // ========================================================

    if (
        req.method === 'GET' &&
        url.pathname === '/api/system'
    ) {

        const totalMemory =
            os.totalmem();

        const freeMemory =
            os.freemem();

        const usedMemory =
            totalMemory -
            freeMemory;

        sendJson(
            res,
            200,
            {
                success: true,

                platform:
                    process.platform,

                arch:
                    process.arch,

                hostname:
                    os.hostname(),

                cpu:
                    os.cpus()[0]
                        ? os.cpus()[0].model
                        : 'Unknown',

                cpuCores:
                    os.cpus().length,

                totalRAM:
                    Math.round(
                        totalMemory /
                        1024 /
                        1024 /
                        1024
                    ) + ' GB',

                usedRAM:
                    Math.round(
                        usedMemory /
                        1024 /
                        1024 /
                        1024
                    ) + ' GB',

                freeRAM:
                    Math.round(
                        freeMemory /
                        1024 /
                        1024 /
                        1024
                    ) + ' GB',

                electron:
                    process.versions.electron,

                chrome:
                    process.versions.chrome,

                node:
                    process.versions.node,

                appVersion:
                    app.getVersion(),

                localIPs:
                    getLocalIPv4Addresses(),

                remotePort:
                    REMOTE_PORT
            }
        );

        return;
    }

    // ========================================================
    // 404
    // ========================================================

    sendJson(
        res,
        404,
        {
            success: false,
            error: 'Not found'
        }
    );
}

// ============================================================
// CREATE WINDOW
// ============================================================

function createWindow() {

        if (process.platform === 'win32') {
        exec(
            'powershell.exe -NoProfile -Command "Get-Process explorer -ErrorAction SilentlyContinue | Out-Null"',
            () => {}
        );
    }

    win = new BrowserWindow({

        width: 1920,
        height: 1080,

        fullscreen: true,
        kiosk: true,

        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: false,

        autoHideMenuBar: true,
        fullscreenable: true,

        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // ============================================================
    // WINDOWS KIOSK
    // ============================================================

    if (process.platform === 'win32') {

        win.setMenuBarVisibility(false);
        win.setResizable(false);

        win.setFullScreen(true);
        win.setKiosk(true);

        win.setAlwaysOnTop(
            true,
            'screen-saver'
        );

        win.show();
        win.focus();
    }

    // ============================================================
    // ДОПОЛНИТЕЛЬНАЯ ФИКСАЦИЯ
    // ============================================================

    setTimeout(() => {

        if (!win || win.isDestroyed()) {
            return;
        }

        win.setFullScreen(true);
        win.setKiosk(true);

        win.setAlwaysOnTop(
            true,
            'screen-saver'
        );

        win.setMenuBarVisibility(false);
        win.setResizable(false);

        win.show();
        win.focus();

    }, 500);

    addLog(
        'Kiosk window created',
        'system'
    );


    

addLog(
    'Kiosk window created',
    'system'
);

    // ========================================================
    // KEY PROTECTION
    // ========================================================

    win.webContents.on(
        'before-input-event',
        (event, input) => {

            if (
                !win ||
                win.isDestroyed()
            ) {
                return;
            }

            if (
                !win.isKiosk()
            ) {
                return;
            }

            const key =
                String(
                    input.key || ''
                ).toLowerCase();

            if (
                (
                    input.control ||
                    input.meta
                ) &&
                key === 'q'
            ) {

                event.preventDefault();

                return;
            }

            if (
                (
                    input.control ||
                    input.meta
                ) &&
                key === 'w'
            ) {

                event.preventDefault();

                return;
            }

            if (
                (
                    input.control ||
                    input.meta
                ) &&
                key === 'r'
            ) {

                event.preventDefault();

                return;
            }

            if (
                input.key === 'F12' ||

                (
                    input.control &&
                    input.shift &&
                    key === 'i'
                ) ||

                (
                    input.meta &&
                    input.alt &&
                    key === 'i'
                )
            ) {

                event.preventDefault();

                return;
            }
        }
    );

    // ========================================================
    // RIGHT CLICK
    // ========================================================

    win.webContents.on(
        'context-menu',
        (event) => {

            event.preventDefault();
        }
    );

    // ========================================================
    // NEW WINDOWS
    // ========================================================

    win.webContents.setWindowOpenHandler(
        () => ({
            action: 'deny'
        })
    );

    // ========================================================
    // NAVIGATION
    // ========================================================

    win.webContents.on(
        'did-navigate',
        async (
            event,
            url
        ) => {

            if (
                currentPage === 'shop'
            ) {

                await addHistory(
                    url
                );
            }
        }
    );

    // ========================================================
    // LOADER
    // ========================================================

    win.loadFile(
        path.join(
            __dirname,
            'src',
            'index.html'
        )
    );

    setTimeout(
        async () => {

            if (
                !win ||
                win.isDestroyed()
            ) {
                return;
            }

            try {

                await win.webContents
                    .executeJavaScript(`
                        const loader =
                            document.getElementById('loader');

                        if (loader) {
                            loader.classList.add('hide');
                        }
                    `);

            } catch (error) {

                addLog(
                    'Loader error: ' +
                    error.message,
                    'error'
                );
            }

            setTimeout(
                async () => {

                    if (
                        !win ||
                        win.isDestroyed()
                    ) {
                        return;
                    }

                    const internet =
                        await checkInternet();

                    if (internet) {

                        openShop();

                    } else {

                        openOffline();
                    }

                },
                1000
            );

        },
        2500
    );

    // ========================================================
    // LOAD ERROR
    // ========================================================

    win.webContents.on(
        'did-fail-load',
        () => {

            if (
                currentPage === 'shop'
            ) {

                addLog(
                    'Site loading failed',
                    'error'
                );

                openOffline();
            }
        }
    );

    // ========================================================
    // CLOSED
    // ========================================================

    win.on(
        'closed',
        () => {

            win = null;
        }
    );
}

// ============================================================
// OPEN SHOP
// ============================================================

function openShop() {

    if (
        !win ||
        win.isDestroyed()
    ) {
        return;
    }

    currentPage = 'shop';

    addLog(
        'Opening shop',
        'info'
    );

    win.loadURL(
        SHOP_URL
    );
}

// ============================================================
// OFFLINE
// ============================================================

function openOffline() {

    if (
        !win ||
        win.isDestroyed()
    ) {
        return;
    }

    if (
        currentPage === 'offline'
    ) {
        return;
    }

    currentPage = 'offline';

    addLog(
        'Internet unavailable - OFFLINE mode',
        'warning'
    );

    win.loadFile(
        path.join(
            __dirname,
            'src',
            'offline.html'
        )
    );

    startInternetMonitoring();
}

// ============================================================
// INTERNET MONITORING
// ============================================================

function startInternetMonitoring() {

    if (checkingInternet) {
        return;
    }

    checkingInternet = true;

    const interval =
        setInterval(
            async () => {

                if (
                    !win ||
                    win.isDestroyed()
                ) {

                    clearInterval(
                        interval
                    );

                    checkingInternet = false;

                    return;
                }

                if (
                    currentPage !== 'offline'
                ) {

                    clearInterval(
                        interval
                    );

                    checkingInternet = false;

                    return;
                }

                const internet =
                    await checkInternet();

                if (internet) {

                    addLog(
                        'Internet restored',
                        'success'
                    );

                    clearInterval(
                        interval
                    );

                    checkingInternet = false;

                    openShop();
                }

            },
            5000
        );
}

// ============================================================
// PIN WINDOW
// ============================================================

// ============================================================
// PIN WINDOW
// ============================================================

function openPinWindow() {

    // Если PIN уже открыт — просто вернуть его наверх
    if (
        pinWindow &&
        !pinWindow.isDestroyed()
    ) {

        pinWindow.show();
        pinWindow.focus();
        pinWindow.moveTop();

        return;
    }

    // ========================================================
    // СОЗДАЁМ PIN WINDOW
    // ========================================================

    pinWindow =
    new BrowserWindow({

        width: 450,
        height: 600,

        resizable: false,

        minimizable: false,
        maximizable: false,
        closable: true,

        fullscreenable: false,

        frame: false,

        autoHideMenuBar: true,

        // PIN является дочерним окном kiosk
        parent:
            win &&
            !win.isDestroyed()
                ? win
                : undefined,

        modal: false,

        alwaysOnTop: true,

        skipTaskbar: true,

        focusable: true,

        backgroundColor: '#0b1020',

        webPreferences: {

            contextIsolation: true,
            nodeIntegration: false,

            preload:
                path.join(
                    __dirname,
                    'preload.js'
                )
        }
    });


// ============================================================
// PIN WINDOW — НЕ ДАЁМ WINDOWS ПОКАЗАТЬ TASKBAR
// ============================================================

pinWindow.setAlwaysOnTop(
    true,
    'screen-saver'
);

pinWindow.setMenuBarVisibility(false);

pinWindow.setSkipTaskbar(true);

pinWindow.show();
pinWindow.focus();

hideWindowsTaskbar();


// ============================================================
// ПОСЛЕ ПОКАЗА PIN ВОЗВРАЩАЕМ KIOSK
// ============================================================



    // ========================================================
    // ПОЗИЦИЯ
    // ========================================================

    pinWindow.center();

    // ========================================================
    // ЗАГРУЗКА PIN
    // ========================================================

    pinWindow.loadFile(
        path.join(
            __dirname,
            'src',
            'pin.html'
        )
    );

    // ========================================================
    // WINDOWS — ПРИНУДИТЕЛЬНО ПОВЕРХ KIOSK
    // ========================================================

    pinWindow.setAlwaysOnTop(
        true,
        'screen-saver'
    );

    pinWindow.setSkipTaskbar(
        true
    );

    // ========================================================
    // ВАЖНО:
    // ОСНОВНОЙ KIOSK НЕ ДОЛЖЕН ТЕРЯТЬ KIOSK MODE
    // ========================================================

    if (
        win &&
        !win.isDestroyed()
    ) {

        win.setKiosk(true);
        win.setFullScreen(true);
        win.setMenuBarVisibility(false);
        win.setResizable(false);
    }

    // ========================================================
    // ПОКАЗ PIN
    // ========================================================

    pinWindow.once(
        'ready-to-show',
        () => {

            if (
                !pinWindow ||
                pinWindow.isDestroyed()
            ) {
                return;
            }

            pinWindow.show();
            pinWindow.focus();
            pinWindow.moveTop();

            // Повторно фиксируем окно поверх всех окон
            pinWindow.setAlwaysOnTop(
                true,
                'screen-saver'
            );

            pinWindow.setSkipTaskbar(
                true
            );
        }
    );

    // ========================================================
    // ЕСЛИ PIN ПОТЕРЯЛ ФОКУС
    // ========================================================

    pinWindow.on(
        'blur',
        () => {

            if (
                !pinWindow ||
                pinWindow.isDestroyed()
            ) {
                return;
            }

            // Через небольшой интервал возвращаем PIN наверх
            setTimeout(
                () => {

                    if (
                        !pinWindow ||
                        pinWindow.isDestroyed()
                    ) {
                        return;
                    }

                    pinWindow.show();
                    pinWindow.focus();
                    pinWindow.moveTop();

                    pinWindow.setAlwaysOnTop(
                        true,
                        'screen-saver'
                    );

                },
                50
            );
        }
    );

    // ========================================================
    // ЗАКРЫТИЕ
    // ========================================================

    pinWindow.on(
        'closed',
        () => {

            pinWindow = null;

            // После закрытия PIN снова фиксируем kiosk
            if (
                win &&
                !win.isDestroyed()
            ) {

                win.setKiosk(true);
                win.setFullScreen(true);
                win.setMenuBarVisibility(false);
                win.setResizable(false);

                win.moveTop();
                win.focus();
            }
        }
    );
}

// ============================================================
// ADMIN PANEL
// ============================================================

function openAdminPanel() {

        if (
        adminWindow &&
        !adminWindow.isDestroyed()
    ) {

        adminWindow.setAlwaysOnTop(
            true,
            'screen-saver'
        );

        adminWindow.setSkipTaskbar(true);

        adminWindow.showInactive();
        adminWindow.moveTop();

        sendUpdateStatus();

        return;
    }

    adminWindow =
        new BrowserWindow({

            width: 1400,
            height: 900,

            minWidth: 1100,
            minHeight: 700,

            resizable: true,

            minimizable: true,
            maximizable: true,

            fullscreenable: false,

            frame: false,

            autoHideMenuBar: true,

            alwaysOnTop: true,

            skipTaskbar: true,

            backgroundColor:
                '#0b1020',

            webPreferences: {

                contextIsolation: true,
                nodeIntegration: false,

                preload:
                    path.join(
                        __dirname,
                        'preload.js'
                    )
            }
        });

    adminWindow.center();

    adminWindow.loadFile(
        path.join(
            __dirname,
            'src',
            'admin.html'
        )
    );

    adminWindow.setAlwaysOnTop(
        true,
        'floating'
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

            adminWindow.showInactive();
adminWindow.moveTop();

adminWindow.setAlwaysOnTop(
    true,
    'screen-saver'
);

adminWindow.setSkipTaskbar(true);

sendUpdateStatus();

hideWindowsTaskbar();
        }
    );

    adminWindow.on(
    'closed',
    () => {

        adminWindow = null;

        hideWindowsTaskbar();
    }
);

    addLog(
        'Admin panel opened',
        'admin'
    );
}

// ============================================================
// ENABLE KIOSK
// ============================================================

function enableKiosk() {

    if (
        !win ||
        win.isDestroyed()
    ) {
        return;
    }

    addLog(
        'Kiosk mode enabled',
        'admin'
    );

    if (
        adminWindow &&
        !adminWindow.isDestroyed()
    ) {

        adminWindow.close();
        adminWindow = null;
    }

    if (
        pinWindow &&
        !pinWindow.isDestroyed()
    ) {

        pinWindow.close();
        pinWindow = null;
    }

    setTimeout(
        () => {

            if (
                !win ||
                win.isDestroyed()
            ) {
                return;
            }

            win.setResizable(false);
            win.setMenuBarVisibility(false);
            win.setFullScreen(true);
            win.setKiosk(true);
            win.moveTop();
            win.focus();

        },
        300
    );
}

// ============================================================
// DISABLE KIOSK
// ============================================================

function disableKiosk() {

    if (
        !win ||
        win.isDestroyed()
    ) {
        return;
    }

    addLog(
        'Kiosk mode disabled',
        'admin'
    );

    win.setKiosk(false);
    win.setFullScreen(false);
    win.setResizable(true);
    win.setMenuBarVisibility(true);

    if (
        adminWindow &&
        !adminWindow.isDestroyed()
    ) {

        adminWindow.show();
        adminWindow.focus();
        adminWindow.moveTop();
    }
}

// ============================================================
// RESTART WHOLE KIOSK
// ============================================================

function restartKiosk() {

    addLog(
        'FULL KIOSK RESTART REQUESTED',
        'warning'
    );

    if (
        adminWindow &&
        !adminWindow.isDestroyed()
    ) {

        adminWindow.close();
        adminWindow = null;
    }

    if (
        pinWindow &&
        !pinWindow.isDestroyed()
    ) {

        pinWindow.close();
        pinWindow = null;
    }

    if (
        win &&
        !win.isDestroyed()
    ) {

        win.close();
        win = null;
    }

    setTimeout(
        () => {

            addLog(
                'Restarting application...',
                'system'
            );

            app.relaunch();

            app.exit(0);

        },
        500
    );
}

// ============================================================
// APP READY
// ============================================================

app.whenReady().then(
    () => {

        initHistory();

        setupAutoUpdater();

        addLog(
            'Application started',
            'system'
        );

        createWindow();

        startRemoteServer();

        globalShortcut.register(
            'CommandOrControl+Shift+A',
            () => {

                addLog(
                    'Admin hotkey pressed',
                    'admin'
                );

                openPinWindow();
            }
        );

        app.on(
            'activate',
            () => {

                if (
                    BrowserWindow
                        .getAllWindows()
                        .length === 0
                ) {

                    createWindow();
                }
            }
        );
    }
);

// ============================================================
// IPC — OPEN ADMIN
// ============================================================

ipcMain.on(
    'admin-open',
    () => {

        addLog(
            'Correct PIN entered',
            'success'
        );

        if (
            pinWindow &&
            !pinWindow.isDestroyed()
        ) {

            pinWindow.close();
            pinWindow = null;
        }

        setTimeout(
            () => {

                openAdminPanel();

            },
            150
        );
    }
);

// ============================================================
// IPC — OPEN SHOP
// ============================================================

ipcMain.on(
    'admin-open-shop',
    () => {

        addLog(
            'Admin requested shop open',
            'admin'
        );

        openShop();

        if (
            adminWindow &&
            !adminWindow.isDestroyed()
        ) {

            adminWindow.show();
            adminWindow.focus();
        }
    }
);

// ============================================================
// IPC — RELOAD SHOP
// ============================================================

ipcMain.on(
    'admin-reload-shop',
    () => {

        if (
            !win ||
            win.isDestroyed()
        ) {
            return;
        }

        addLog(
            'Shop reloaded',
            'info'
        );

        win.reload();
    }
);

// ============================================================
// IPC — INTERNET
// ============================================================

ipcMain.handle(
    'admin-check-internet',
    async () => {

        return await checkInternet();
    }
);

ipcMain.handle(
    'admin-exit-app',
    () => {

        console.log(
            'ADMIN REQUESTED FULL APPLICATION EXIT'
        );

        addLog(
            'Application completely closed by administrator',
            'admin'
        );

        app.exit(0);
    }
);

// ============================================================
// IPC — STATUS
// ============================================================

ipcMain.handle(
    'admin-get-status',
    async () => {

        const internet =
            await checkInternet();

        const uptimeSeconds =
            Math.floor(
                (
                    Date.now() -
                    startTime
                ) / 1000
            );

        const hours =
            Math.floor(
                uptimeSeconds / 3600
            );

        const minutes =
            Math.floor(
                (
                    uptimeSeconds %
                    3600
                ) / 60
            );

        const seconds =
            uptimeSeconds % 60;

        return {

            internet,

            page:
                currentPage,

            kiosk:
                win &&
                !win.isDestroyed()
                    ? win.isKiosk()
                    : false,

            uptime:
                `${hours}h ${minutes}m ${seconds}s`,

            historyCount:
                browsingHistory.length,

            lastCheck:
                lastInternetCheck
                    ? lastInternetCheck
                        .toLocaleTimeString(
                            'pl-PL'
                        )
                    : 'Brak danych',

            localIPs:
                getLocalIPv4Addresses(),

            remotePort:
                REMOTE_PORT,

            appVersion:
                app.getVersion()
        };
    }
);

// ============================================================
// IPC — HISTORY
// ============================================================

ipcMain.handle(
    'admin-get-history',
    () => {

        return browsingHistory;
    }
);

// ============================================================
// IPC — CLEAR HISTORY
// ============================================================

ipcMain.on(
    'admin-clear-history',
    () => {

        browsingHistory = [];

        saveHistory();

        addLog(
            'Browsing history cleared',
            'admin'
        );
    }
);

// ============================================================
// IPC — LOGS
// ============================================================

ipcMain.handle(
    'admin-get-logs',
    () => {

        return applicationLogs;
    }
);

// ============================================================
// IPC — SYSTEM
// ============================================================

ipcMain.handle(
    'admin-get-system-info',
    () => {

        const totalMemory =
            os.totalmem();

        const freeMemory =
            os.freemem();

        const usedMemory =
            totalMemory -
            freeMemory;

        return {

            platform:
                process.platform,

            arch:
                process.arch,

            hostname:
                os.hostname(),

            cpu:
                os.cpus()[0]
                    ? os.cpus()[0].model
                    : 'Unknown',

            cpuCores:
                os.cpus().length,

            totalRAM:
                Math.round(
                    totalMemory /
                    1024 /
                    1024 /
                    1024
                ) + ' GB',

            usedRAM:
                Math.round(
                    usedMemory /
                    1024 /
                    1024 /
                    1024
                ) + ' GB',

            freeRAM:
                Math.round(
                    freeMemory /
                    1024 /
                    1024 /
                    1024
                ) + ' GB',

            electron:
                process.versions.electron,

            chrome:
                process.versions.chrome,

            node:
                process.versions.node,

            appVersion:
                app.getVersion(),

            localIPs:
                getLocalIPv4Addresses(),

            remotePort:
                REMOTE_PORT
        };
    }
);

// ============================================================
// IPC — KIOSK
// ============================================================

ipcMain.on(
    'admin-disable-kiosk',
    () => {

        disableKiosk();
    }
);

ipcMain.on(
    'admin-enable-kiosk',
    () => {

        enableKiosk();
    }
);

// ============================================================
// IPC — RESTART
// ============================================================

ipcMain.on(
    'admin-restart-kiosk',
    () => {

        restartKiosk();
    }
);

// ============================================================
// IPC — UPDATE STATUS
// ============================================================

ipcMain.handle(
    'admin-get-update-status',
    () => {

        return getUpdateStatus();
    }
);

// ============================================================
// IPC — CHECK UPDATE
// ============================================================

ipcMain.handle(
    'admin-check-update',
    async () => {

        return await checkForUpdates();
    }
);

// ============================================================
// IPC — DOWNLOAD UPDATE
// ============================================================

ipcMain.handle(
    'admin-download-update',
    async () => {

        return await downloadUpdate();
    }
);

// ============================================================
// IPC — INSTALL UPDATE
// ============================================================

ipcMain.handle(
    'admin-install-update',
    () => {

        return installUpdate();
    }
);

// ============================================================
// IPC — CLOSE ADMIN
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
// QUIT
// ============================================================

app.on(
    'will-quit',
    () => {

        globalShortcut.unregisterAll();

        stopRemoteServer();
    }
);

// ============================================================
// ALL WINDOWS CLOSED
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