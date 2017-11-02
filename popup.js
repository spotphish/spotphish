/*
 * Copyright (C) 2017 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file LICENSE for license details.
 */

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
        const state = response._state;
        if (state === "greenflagged") {
            $("#kp-remove-from-whitelist").css({display: "flex"});
            $("#kp-test-now").css({display: "flex"});
            $("#kp-status-span").addClass("mdl-color-text--primary");
        } else if (state === "watching" || state === "red_done" || state === "safe") {
            $("#kp-add-to-whitelist").css({display: "flex"});
            $("#kp-status-span").addClass("mdl-color-text--primary");
        } else if (state === "init") {
            $("#kp-add-to-whitelist").css({display: "flex"});
            $("#kp-status-span").addClass("mdl-color-text--primary");
        } else {
            $("#kp-status-span").addClass("mdl-color-text--accent");
        }
    };

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        curTab = tabs[0];

        $(document).ready(function() {
            $("#kp-add-to-whitelist").on("click", e => {
                chrome.runtime.sendMessage({op: "protect_page", tab: curTab}, res => {
                    /* notify */
                });
                window.close();
            });
            $("#kp-remove-from-whitelist").on("click", e => {
                chrome.runtime.sendMessage({op: "unprotect_page", tab: curTab}, res => {
                        /* notify */
                });
                window.close();
            });
            $("#kp-test-now").on("click", e => {
                chrome.runtime.sendMessage({op: "test_now", tab: curTab});
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
