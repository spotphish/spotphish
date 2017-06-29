/*global chrome */

(function () {
    var curTab;

    var handleTabInfo = function(response) {
        if (!response) {
            return;
        }
        if (response.whitelisted) {
            //document.getElementById('kp-remove-from-whitelist').style.display = 'block';
            document.getElementById('kp-add-to-whitelist').style.display = 'none';
        } else {
            document.getElementById('kp-add-to-whitelist').style.display = 'block';
        }
    }

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        curTab = tabs[0];
        console.log("Current tab : ", curTab);
        if (isSpecialTab(curTab.url)) {
            document.getElementById('kp-add-to-whitelist').style.display = 'none';
        } else {
            chrome.runtime.sendMessage({message: "wl_check", url: stripQueryParams(curTab.url)}, handleTabInfo);
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
        document.getElementById('kp-add-to-whitelist').addEventListener('click', function (e) {
            var site = stripQueryParams(curTab.url);
            chrome.runtime.sendMessage({ message: 'addToWhitelist', site: site, currentTab: curTab});
            window.close();
        });
        document.getElementById('kp-remove-from-whitelist').addEventListener('click', function (e) {
            var site = stripQueryParams(curTab.url);
            chrome.runtime.sendMessage({ message: 'removeFromWhitelist', site: site});
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
