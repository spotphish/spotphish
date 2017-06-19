/*global chrome */

(function () {
    var curTab;

    var handleTabInfo = function(response) {
        if (!response) {
            return;
        }
        if (response.status === tab_status.WHITELISTED) {
            document.getElementById('kp-remove-from-whitelist').style.display = 'block';
            document.getElementById('kp-add-to-whitelist').style.display = 'none';
            //document.getElementsByClassName('optsCurrent')[0].style.display = 'block';
        } else if (response.status === tab_status.NOT_WHITELISTED) {
            document.getElementById('kp-add-to-whitelist').style.display = 'block';
            //document.getElementsByClassName('optsCurrent')[0].style.display = 'block';
        }
    }

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        curTab = tabs[0];
        console.log("Current tab : ", curTab);
        if (isSpecialTab(curTab.url)) {
            chrome.runtime.sendMessage({message: "update_info", curtab: curTab, status: tab_status.NA});
        } else {
            chrome.runtime.sendMessage({message: "get_tabinfo", curtab: curTab}, handleTabInfo);
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
        document.getElementById('kp-add-to-whitelist').addEventListener('click', function (e) {
            var site = stripQueryParams(curTab.url);
            chrome.runtime.sendMessage({ message: 'addToWhitelist', site: site});
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
