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
        title: "Are you being phished?",
        type: "warning",
        img: img,
        main: `<div class="kpmdl-color-text--accent"> This looks like <b>${msg.site}</b>. But it isn't!</div>`,
        extra: "In case you get frequent false alarms on a trusted site, add it to the <em>Safe Domains</em> list.",
        buttons: [{html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=0>Dismiss</button>`, onclick: null},
            {html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=1 >Add To Safe Domains</button>`, onclick: openSafeDomainLink},
            {html: `<button class="kpmdl-button kpmdl-button--colored kpmdl-button--disabled" kp-button-index=2>Report Phishing</button>`, onclick: null}]
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

function injectAckModal(message = "All done", image) {
    var img = document.createElement("img");
    const ack = {
        title: "SpotPhish",
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
        chrome.runtime.sendMessage({
            op: "protect_basic"
        }, function (res) {
            setTimeout(x => injectAckModal("Basic protection enabled for this page"), 500);
        });
    }

    const cropDialog = {
        title: "Protect Page",
        type: "info",
        main: "Basic or Enhanced?",
        extra: "<div>With <b>basic protection</b>, your personal security image will be displayed every time you visit this page.</div><br><div>For <b>enhanced protection</b>, identify the most recognizable part of the page, like the area around the logo. You will be alerted if any other page looks like this one.</div>",
        buttons: [{html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=0>Enhance!</button>`, onclick: crop},
            {html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=1>Basic</button>`, onclick: basic}]
    };

    dialog(cropDialog);
}

function showMatch(msg) {
    var img = document.createElement("img");
    img.src = msg.img;
    const warn = {
        title: "Template Matched",
        type: "warning",
        img: img,
        main: `<div class="kpmdl-color-text--accent"> This looks like <b>${msg.site}</b>.</div>`,
        buttons: [{html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=0>OK</button>`, onclick: null}],
    };
    dialog(warn);
}

function showNoMatch() {
    const ack1 = {
        title: "SpotPhish",
        type: "info",
        main: "No template matches found for this page.",
        extra: null,
        buttons: [{html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=0>OK</button>`, onclick: null}],
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
