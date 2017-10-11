/*global chrome */

(function () {
    var curTab;

    var handleTabInfo = function(response) {
        if (!response) {
            return;
        }
        if (response.status) {
            $("#kp-status").css({display: "flex"});
            $("#kp-status-span").append(`<em>${response.status}</em>`);
        }
        if (response.state === "greenflagged") {
            $("#kp-remove-from-whitelist").css({display: "flex"});
            $("#kp-status-span").addClass("mdl-color-text--primary");
        } else if (response.state === "watching" || response.state === "red_done" || response.state === "safe") {
            $("#kp-add-to-whitelist").css({display: "flex"});
            $("#kp-test-now").css({display: "flex"});
            $("#kp-status-span").addClass("mdl-color-text--primary");
        } else if (response.state === "init") {
            $("#kp-status-span").addClass("mdl-color-text--primary");
            $("#kp-test-now").css({display: "flex"});
        } else {
            $("#kp-status-span").addClass("mdl-color-text--accent");
            $("#kp-test-now").css({display: "flex"});
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
                chrome.runtime.sendMessage({ op: "removeFromWhitelist", currentTab: curTab, site: site}, res => {
                    if (res.message === "removed") {
                        /* notify */
                    }
                });
                window.close();
            });
            $("#kp-test-now").on("click", e => {
                chrome.runtime.sendMessage({op: "urgent_check", curtab: curTab});
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
