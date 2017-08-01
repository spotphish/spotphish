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
    const warn = {
        title: "Are you being phished?",
        type: "warning",
        main: `<div class="kpmdl-color-text--accent"> This looks like <b>${msg.site}</b>. But it isn't!</div>`,
        extra: "In case of frequent false alarms on a trusted site, add it to the <em>Safe Domains</em> list.",
        buttons: [{html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=0>Dismiss</button>`, onclick: null},
            {html: `<button class="kpmdl-button kpmdl-button--colored kpmdl-button--disabled" kp-button-index=1>Report Phishing</button>`, onclick: null}]
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

var jcrop, selection;
var overlay = ((active) => (state) => {
    active = (typeof state === "boolean") ? state : (state === null) ? active : !active;
    if (!active) {
        $(".jcrop-holder").show();
    }
    //chrome.runtime.sendMessage({message: "active", active})
    $(document).keyup(function(event) {
        if (event.which === 27 || event.which === "27") {
            $(".jcrop-holder").hide();
            $(".jcrop-holder .kp-template-page").remove();
            $(".kp-popup").remove();
        }
    });
})(false);

var image = (done) => {
    var image = new Image();
    image.id = "fake-image";
    image.src = chrome.runtime.getURL("/assets/img/pixel.png");
    image.onload = () => {
        $("body").append(image);
        done();
    };
};

var init = (done) => {
    debug("Inside init");
    $("#fake-image").Jcrop({
        bgColor: "none",
        maxSize: [500, 300],
        onSelect: (e) => {
            debug("Jcrop fakeimg");
            selection = e;
            capture();
        },
        onChange: (e) => {
            selection = e;
        },
        onRelease: (e) => {
            setTimeout(() => {
                selection = null;
            }, 100);
        }
    }, function ready() {
        debug("jcrop initialized");
        jcrop = this;

        $(".jcrop-hline, .jcrop-vline").css({
            backgroundImage: "url(" + chrome.runtime.getURL("/assets/img/Jcrop.gif") + ")"
        });

        if (selection) {
            jcrop.setSelect([
                selection.x, selection.y,
                selection.x2, selection.y2
            ]);
        }
        done && done();
    });
};

var capture = (force) => {
    debug("capture", selection);
    if (selection) {
        // jcrop.release();
        $(".jcrop-holder .kp-template-page").remove();
        const screenshotTemplate = `<div class="kp-template-page" style="position: absolute; top:${selection.y - 2 }px; left: ${selection.x - 2 }px; z-index: 9999; ">
                <div style="width: ${selection.w + 2}px; height: ${selection.h + 2}px;">
                </div>
                <div style="z-index: 99999">
                    <button  class="kp-screenshot-confirum"> Confirm </button>
                    <button class="kp-screenshot-cancel"> Cancel </button>
                </div>
            </div>`;
        $(".jcrop-holder").append(screenshotTemplate);
        $(".kp-screenshot-confirum").on("click", function(event) {
            debug("Inside screenshot confirum");
            $(".jcrop-holder .kp-template-page").remove();
            $(".jcrop-holder").hide();
            $("body").removeClass("kp-popup");
            setTimeout(function() {
                chrome.runtime.sendMessage({
                    op: "crop_capture",
                    area: selection,
                    dpr: devicePixelRatio
                }, (res) => {
                    selection = null;
                });
            }, 100);
            debug(selection);
        });

        $(".kp-screenshot-cancel").on("click", function(event) {
            $(".jcrop-holder").hide();
            selection = null;
            jcrop.destroy();
            $(".jcrop-holder").hide();
            $(".jcrop-holder .kp-template-page").remove();
            $(".kp-popup").remove();
        });


        // setTimeout(() => {
        //     chrome.runtime.sendMessage({
        //         op: "crop_capture", area: selection, dpr: devicePixelRatio
        //     }, (res) => {
        //         overlay(false);
        //         selection = null;
        //         console.log(res);
        //     //save(res.image)
        //     });
        // }, 50);
    }
};

/*
var filename = () => {
  var pad = (n) => ((n = n + "") && (n.length >= 2 ? n : "0" + n))
  var timestamp = ((now) =>
    [pad(now.getFullYear()), pad(now.getMonth() + 1), pad(now.getDate())].join("-")
    + " - " +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("-")
  )(new Date())
  return "KP-" + timestamp + ".png"
}

var save = (image) => {
  var link = document.createElement("a")
  link.download = filename()
  link.href = image
  link.click()
}
window.addEventListener("resize", ((timeout) => () => {
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    jcrop.destroy()
    init(() => overlay(null))
  }, 100)
})())
*/



function injectCropModal() {
    debug("inside inject");
    var doCrop = function() {
        if (!jcrop) {
            image(() => init(() => {
                overlay();
                capture();
            }));
        } else {
            $("#fake-image").remove();
            image(() => init(() => {
                overlay();
                capture();
            }));
        }
    };

    var noCrop = function() {
        chrome.runtime.sendMessage({
            op: "add_wh"
        });
    };

    const cropDialog = {
        title: "Protect Page",
        type: "info",
        main: "Basic protection enabled",
        extra: "<div>Your personal security image will be displayed time you visit this page.</div><br><div>For enhanced protection, select the part of the page by which you identify this site. The logo is usually a good choice. You will be alerted if any other page looks like this one - it may be a phishing attempt!</div>",
        buttons: [{html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=0>Enhance!</button>`, onclick: doCrop},
            {html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=1>Stick with basic</button>`, onclick: noCrop}]
    };

    dialog(cropDialog);
    return true;
}
