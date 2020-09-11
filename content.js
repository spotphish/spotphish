/*
 * Copyright (C) 2017 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file LICENSE for license details.
 */

const POLL_INTERVAL = 2000; /* Periodicity of redflag candidate check */
const MAX_POLLS = 30; /* Give up after polling x times */

const URL_POLL_INTERVAL = 500; /* Periodicity of URL change check */
const MAX_UPOLLS = 30;

let port;
let topUrl;

let DEBUG = true;

main();

function main() {
    if (window === top) {
        port = chrome.runtime.connect();
        port.onMessage.addListener(msg => {
            if (!msg.op) {
                console.log("KP: Invalid msg from background?!", msg);
            }
            if (msg.op === "greenflag") {
                showGreenflag(msg);
            } else if (msg.op === "redflag") {
                showRedflag(msg);
            } else if (msg.op === "crop_template") {
                injectCropModal();
            } else if (msg.op === "crop_duplicate") {
                alert("This site already added to whitelist");
            } else if (msg.op == "test_match") {
                showMatch(msg);
            } else if (msg.op == "test_no_match") {
                showNoMatch();
            } else {
                console.log("KP: unknown op", msg);
            }
        });
    }

    $(document).ready(do_init);
}

function do_init() {
    const init = { op: "init", top: false };
    if (window === top) {
        init.top = true;
        init.dpr = devicePixelRatio;
        init.inputFields = scanInputFields();
    }
    topUrl = stripQueryParams(window.location.href);

    rpc(init).then(x => {
        if (x.action === "check") {
            startChecking();
        } else if (x.action === "nop") {
            /* nothing to do here, move along */
        } else {
            console.log("KP: unknown action", x);
        }
    });
    if (window === top) {
        startUrlPoll();
    }

    function urgentCheck() {
        console.log("key event captured");
        rpc({ op: "urgent_check"});
        $(document).off("keypress", urgentCheck);
    }

    $(document).on("keypress", urgentCheck);
}

let upolls = 0;

function startUrlPoll() {
    const url = stripQueryParams(window.location.href);

    upolls++;
    if (url !== topUrl) {
        topUrl = url;
        rpc({ op: "url_change" });
    }
    if (upolls < MAX_UPOLLS) {
        return setTimeout(startUrlPoll, URL_POLL_INTERVAL);
    }
}

let npolls = 0;

function startChecking() {
    npolls++;
    const visible = $("input[type=\"password\"]").filter(":visible");
    //const visible = document.querySelectorAll("input[type=\"password\"]");
    if (visible.length > 0) {
        debug("KP: password field found");
        rpc({ op: "checkdata", data: visible });
    } else {
        if (npolls < MAX_POLLS) {
            return setTimeout(startChecking, POLL_INTERVAL);
        }
    }
}

function showGreenflag(msg) {
    chrome.storage.local.get("secure_img", function(result) {
        var data = result.secure_img;
        var img = document.createElement("img");
        img.id = "kp-secure-img";
        img.src = data.src;

        const greenflag = {
            title: "Security Image",
            type: "info",
            img: img,
            extra: msg.site ? `Verified <b>${msg.site}</b>` : "",
            buttons: [],
            dismiss_after: 3500
        };
        dialog(greenflag);
    });
}

function showRedflag(msg) {
    let safeDomainLink = chrome.extension.getURL("option.html") + "?tab=safedomain&host=" + window.location.hostname;
    function openSafeDomainLink() {
        window.open(safeDomainLink);
    }
    var img = document.createElement("img");
    img.src = msg.img;
    const warn = {
        title: chrome.i18n.getMessage("redFlagTitle"),
        type: "warning",
        img: img,
        main: `<div class="kpmdl-color-text--accent"> ${chrome.i18n.getMessage("redFlagMain1")} <b>${msg.site}</b>${chrome.i18n.getMessage("redFlagMain2")}</div>`,
        extra: chrome.i18n.getMessage("redFlagExtra"),
        buttons: [{html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=0>${chrome.i18n.getMessage("redFlagButtonDismiss")}</button>`, onclick: null},
            {html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=1 >${chrome.i18n.getMessage("redFlagButtonSafeDomains")}</button>`, onclick: openSafeDomainLink},
            {html: `<button class="kpmdl-button kpmdl-button--colored kpmdl-button--disabled" kp-button-index=2>${chrome.i18n.getMessage("redFlagButtonReport")}</button>`, onclick: null}]
    };

    dialog(warn);
}

function rpc(msg) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(msg, res => {
            return (res === undefined) ? reject({ error: chrome.runtime.lastError }) : resolve(res);
        });
    });
}

function injectAckModal(message = chrome.i18n.getMessage("injectAckModalDefault"), image) {
    var img = document.createElement("img");
    const ack = {
        title: chrome.i18n.getMessage("extName"),
        type: "info",
        main: message,
        extra: null,
        buttons: [{html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=0>OK</button>`, onclick: null}],
        dismiss_after: 3000
    };
    if (image) {
        img.src = image;
        ack.img = img;
    }
    dialog(ack);
}

function injectCropModal() {
    function basic() {
        $(".kp-dialog").css({opacity: 0});
        // setTimeout(() => {
        //     $(".kp-dialog").remove();
        //     chrome.runtime.sendMessage({
        //         op: "crop_capture",
        //         dpr : devicePixelRatio
        //     }, function (res) {
        //         let msg = "";
        //         if (res.message == "cropped"){
        //             msg = chrome.i18n.getMessage("injectAckModalCropped");
        //         } 
        //         else if (res.message == "nohash"){
        //             msg = chrome.i18n.getMessage("injectAckModalNohash");
        //         }
        //         else
        //             msg - chrome.i18n.getMessage("injectAckModalError");
        //         setTimeout(x => injectAckModal(msg), 500);
        //     }); 
        // }, 400);
        chrome.runtime.sendMessage({
            op: "protect_basic",
        }, function (res) {
            setTimeout(x => injectAckModal("Basic protection enabled for this page"), 500);
        }); 
    }

    const cropDialog = {
        title: chrome.i18n.getMessage("protectPageTitle"),
        type: "info",
        main: chrome.i18n.getMessage("protectPageMainMessage"),
        extra: `<div>${chrome.i18n.getMessage("protectPageExtraMessage")}</div>`,
        buttons: [{html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=0>${chrome.i18n.getMessage("protectPageButtonProtect")}</button>`, onclick: basic}]
    };

    dialog(cropDialog);
}

function showMatch(msg) {
    var img = document.createElement("img");
    img.src = msg.img;
    const warn = {
        title: chrome.i18n.getMessage("templateMactchedTitle"),
        type: "warning",
        img: img,
        main: `<div class="kpmdl-color-text--accent"> ${chrome.i18n.getMessage("templateMatchedMessage")} <b>${msg.site}</b>.</div>`,
        buttons: [{html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=0>${chrome.i18n.getMessage("okButton")}</button>`, onclick: null}],
    };
    dialog(warn);
}

function showNoMatch() {
    const ack1 = {
        title: chrome.i18n.getMessage("extName"),
        type: "info",
        main: chrome.i18n.getMessage("templateNotMatchedMessage"),
        extra: null,
        buttons: [{html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=0>${chrome.i18n.getMessage("okButton")}</button>`, onclick: null}],
        dismiss_after: 3000
    };
    dialog(ack1);
}

function scanInputFields() {
    let ip = {};
    $("input").filter(":visible").map(function() {
        if (ip[this.type]) {
            ip[this.type]++;
        } else {
            ip[this.type] = 1;
        }
    });
    console.log("IP : ", ip);
    return ip;
}
