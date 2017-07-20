/*global chrome */

(function () {
    var curTab;

    var handleTabInfo = function(response) {
        if (!response) {
            return;
        }
        console.log(response);
        if (response.status === "greenflagged") {
            document.getElementById("kp-remove-from-whitelist").style.display = "block";
            document.getElementById("kp-add-to-whitelist").style.display = "none";
            //document.getElementsByClassName("optsCurrent")[0].style.display = "block";
        } else if (response.status === "watching" || response.status === "red_done") {
            document.getElementById("kp-add-to-whitelist").style.display = "block";
        } else if (response.status === "redflagged") {
            document.getElementById("kp-add-to-whitelist").style.display = "none";
        }else {
            document.getElementById("kp-remove-from-whitelist").style.display = "none";
            document.getElementById("kp-add-to-whitelist").style.display = "none";
        }
    };

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        curTab = tabs[0];
        console.log("Current tab : ", curTab);
        if (isSpecialTab(curTab.url)) {
            document.getElementById("kp-add-to-whitelist").style.display = "none";
        } else {
            chrome.runtime.sendMessage({op: "get_tabinfo", curtab: curTab}, handleTabInfo);
        }
    });

    document.addEventListener("DOMContentLoaded", function () {
        document.getElementById("kp-add-to-whitelist").addEventListener("click", function (e) {
            var site = stripQueryParams(curTab.url);
            chrome.runtime.sendMessage({ op: "addToWhitelist", currentTab: curTab, site: site}, res => {
                if (res.message === "whitelisted") {
                    document.getElementById("kp-remove-from-whitelist").style.display = "block";
                    document.getElementById("kp-add-to-whitelist").style.display = "none";
                }
            });
            window.close();
        });
        document.getElementById("kp-remove-from-whitelist").addEventListener("click", function (e) {
            var site = stripQueryParams(curTab.url);
            chrome.runtime.sendMessage({ op: "removeFromWhitelist", site: site}, res => {
                if (res.message === "removed") {
                    isRemoved = true;
                    document.getElementById("kp-remove-from-whitelist").style.display = "none";
                    document.getElementById("kp-add-to-whitelist").style.display = "block";
                }
            });
            window.close();
        });
        document.getElementById("settingsLink").addEventListener("click", function (e) {
            chrome.tabs.create({
                url: chrome.extension.getURL("option.html")
            });
            window.close();
        });

    });
}());
