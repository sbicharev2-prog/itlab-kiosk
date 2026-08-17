const {
    contextBridge,
    ipcRenderer
} = require('electron');

contextBridge.exposeInMainWorld(
    'electronAPI',
    {

        // ====================================================
        // RESTART KIOSK
        // ====================================================

        restartKiosk: () => {

            ipcRenderer.send(
                'admin-restart-kiosk'
            );
        },

        // ====================================================
        // PIN / ADMIN
        // ====================================================

        openAdmin: () => {

            ipcRenderer.send(
                'admin-open'
            );
        },

        closeAdmin: () => {

            ipcRenderer.send(
                'admin-close'
            );
        },

        // ====================================================
        // SHOP
        // ====================================================

        openShop: () => {

            ipcRenderer.send(
                'admin-open-shop'
            );
        },

        reloadShop: () => {

            ipcRenderer.send(
                'admin-reload-shop'
            );
        },

        // ====================================================
        // INTERNET
        // ====================================================

        checkInternet: () => {

            return ipcRenderer.invoke(
                'admin-check-internet'
            );
        },

        // ====================================================
        // STATUS
        // ====================================================

        getStatus: () => {

            return ipcRenderer.invoke(
                'admin-get-status'
            );
        },

        // ====================================================
        // HISTORY
        // ====================================================

        getHistory: () => {

            return ipcRenderer.invoke(
                'admin-get-history'
            );
        },

        clearHistory: () => {

            ipcRenderer.send(
                'admin-clear-history'
            );
        },

        // ====================================================
        // LOGS
        // ====================================================

        getLogs: () => {

            return ipcRenderer.invoke(
                'admin-get-logs'
            );
        },

        // ====================================================
        // SYSTEM
        // ====================================================

        getSystemInfo: () => {

            return ipcRenderer.invoke(
                'admin-get-system-info'
            );
        },

        // ====================================================
        // KIOSK
        // ====================================================

        enableKiosk: () => {

            ipcRenderer.send(
                'admin-enable-kiosk'
            );
        },

        disableKiosk: () => {

            ipcRenderer.send(
                'admin-disable-kiosk'
            );
        },

        // ====================================================
        // UPDATE
        // ====================================================

        getUpdateStatus: () => {

            return ipcRenderer.invoke(
                'admin-get-update-status'
            );
        },

        checkForUpdate: () => {

            return ipcRenderer.invoke(
                'admin-check-update'
            );
        },

        downloadUpdate: () => {

            return ipcRenderer.invoke(
                'admin-download-update'
            );
        },

        installUpdate: () => {

            return ipcRenderer.invoke(
                'admin-install-update'
            );
        },

        onUpdateStatus: (
            callback
        ) => {

            const listener =
                (
                    event,
                    data
                ) => {

                    callback(data);
                };

            ipcRenderer.on(
                'update-status',
                listener
            );

            return () => {

                ipcRenderer.removeListener(
                    'update-status',
                    listener
                );
            };
        },

        // ====================================================
        // GENERIC IPC
        // ====================================================

        send: (
            channel,
            data
        ) => {

            const allowedChannels = [

                'admin-open',
                'admin-close',

                'admin-open-shop',
                'admin-reload-shop',

                'admin-restart-kiosk',

                'admin-clear-history',

                'admin-enable-kiosk',
                'admin-disable-kiosk'

            ];

            if (
                !allowedChannels.includes(
                    channel
                )
            ) {

                console.warn(
                    'Blocked IPC channel:',
                    channel
                );

                return;
            }

            ipcRenderer.send(
                channel,
                data
            );
        }

    }
);