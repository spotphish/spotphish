/*global chrome */

(function () {

    'use strict';

    function setSuspendOneVisibility(visible) {
        if (visible) {
            document.getElementById('suspendOne').style.display = 'block';
        } else {
            document.getElementById('suspendOne').style.display = 'none';
        }
    }

    function setSuspendSelectedVisibility() {
        chrome.tabs.query({highlighted: true, lastFocusedWindow: true}, function (tabs) {
            if (tabs && tabs.length > 1) {
                document.getElementById('suspendSelectedGroup').style.display = 'block';
            } else {
                document.getElementById('suspendSelectedGroup').style.display = 'none';
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.getElementById('kp-add-to-whitelist').addEventListener('click', function (e) {
            chrome.runtime.sendMessage({ action: 'suspendOne' });
            window.close();
        });
        document.getElementById('kp-remove-from-whitelist').addEventListener('click', function (e) {
            chrome.runtime.sendMessage({ action: 'suspendOne' });
            window.close();
        });
        document.getElementById('settingsLink').addEventListener('click', function (e) {
            chrome.tabs.create({
                url: chrome.extension.getURL('options.html')
            });
            window.close();
        });

        chrome.extension.getBackgroundPage().tgs.requestTabInfo(false, function (info) {

            var status = info.status,
                //timeLeft = info.timerUp, // unused
                suspendOneVisible = (status === 'suspended' || status === 'special' || status === 'unknown') ? false : true,
                whitelistVisible = (status !== 'whitelisted' && status !== 'special') ? true : false,
                pauseVisible = (status === 'normal') ? true : false;

            setSuspendSelectedVisibility();
            setSuspendOneVisibility(suspendOneVisible);
            setWhitelistVisibility(whitelistVisible);
            setPauseVisibility(pauseVisible);
            setStatus(status);
        });
    });
}());
