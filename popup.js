/*global chrome */

(function () {
    var curTab;

    var handleTabInfo = function(response) {
        if (!response) {
            return;
        }
        if (response.status === "greenflagged") {
            $("#kp-remove-from-whitelist").css({display: "flex"});
        } else if (response.status === "watching" || response.status === "red_done" || response.status === "safe") {
            $("#kp-add-to-whitelist").css({display: "flex"});
        }
    };

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        curTab = tabs[0];

        $(document).ready(function() {
            $("#kp-add-to-whitelist").on("click", e => {
                var site = stripQueryParams(curTab.url);
                chrome.runtime.sendMessage({ op: "addToWhitelist", currentTab: curTab, site: site}, res => {
                    if (res.message === "whitelisted") {
                        /* notify */
                    }
                });
                window.close();
            });
            $("#kp-remove-from-whitelist").on("click", e => {
                var site = stripQueryParams(curTab.url);
                chrome.runtime.sendMessage({ op: "removeFromWhitelist", site: site}, res => {
                    if (res.message === "removed") {
                        /* notify */
                    }
                });
                window.close();
            });
            $("#settingsLink").on("click", e => {
                chrome.tabs.create({
                    url: chrome.extension.getURL("option.html")
                });
                window.close();
            });
        });

        if (!isSpecialTab(curTab.url)) {
            chrome.runtime.sendMessage({op: "get_tabinfo", curtab: curTab}, handleTabInfo);
        }
    });

}());
