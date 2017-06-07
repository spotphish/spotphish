/*global chrome */

(function () {

    document.addEventListener('DOMContentLoaded', function () {
        document.getElementById('kp-add-to-whitelist').addEventListener('click', function (e) {
            //chrome.runtime.sendMessage({ action: 'suspendOne' });
            window.close();
        });
        document.getElementById('kp-remove-from-whitelist').addEventListener('click', function (e) {
            //chrome.runtime.sendMessage({ action: 'suspendOne' });
            window.close();
        });
        document.getElementById('settingsLink').addEventListener('click', function (e) {
            chrome.tabs.create({
                url: chrome.extension.getURL('option.html')
            });
            window.close();
        });

    });
}());
