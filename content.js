const POLL_INTERVAL = 2000; /* Periodicity of redflag candidate check */
const MAX_POLLS = 30; /* Give up after polling x times */

let port;

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
    rpc(init).then(x => {
        if (x.action === "check") {
            startChecking();
        } else if (x.action === "nop") {
            /* nothing to do here, move along */
        } else {
            console.log("KP: unknown action", x);
        }
    });
}

let npolls = 0;

function startChecking() {
    npolls++;
    const visible = $("input[type=\"password\"]").filter(":visible").length;
    //const visible = document.querySelectorAll("input[type=\"password\"]");
    console.log("Started checking in content script");
    if (visible.length > 0) {
        console.log("password field found");
        rpc({ op: "checkdata", data: visible });
    } else {
        if (npolls < MAX_POLLS) {
            return setTimeout(startChecking, POLL_INTERVAL);
        }
    }
}

function showGreenflag(msg) {
    appendSecureImg();
}

function showRedflag(msg) {
    coverContainer($("body"), msg.site, "", false, true, true, 0);
}

function appendSecureImg() {
    const prepend = `
<div class="kp-img-container">
    <div class="FAH_closeButton kp-img-close">
        <strong> X </strong>
    </div>
</div>`;

    $("body").prepend(prepend);
    chrome.storage.local.get("secure_img", function(result) {
        var data = result.secure_img;
        console.log("Data received : ", data);
        if (data === undefined) {
            data = {};
            data.type = "default";
            data.src = DEFAULT_IMG;
            updateImage(data);
            return;
        }
        var img = document.createElement("img");
        img.height = data.height || 200;
        img.width = data.width || 200;
        img.id = "kp-secure-img";
        img.src = data.src;
        //$(".image").empty();
        $(".kp-img-container").append(img);

        $(".kp-img-close").on("click", function(e) {
            e.preventDefault();
            $(".kp-img-container").css("display", "none");

        });
    });
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
    console.log("Inside init");
    $("#fake-image").Jcrop({
        bgColor: "none",
        maxSize: [500, 300],
        onSelect: (e) => {
            console.log("Jcrop fakeimg");
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
        console.log("jcrop initialized");
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
    console.log(selection);
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
            console.log("Inside screenshot confirum");
            overlay(false);
            $(".jcrop-holder").hide();
            $(".jcrop-holder .kp-template-page").remove();
            $("body").removeClass("kp-popup");
            console.log(selection);
            chrome.runtime.sendMessage({
                op: "crop_capture",
                area: selection,
                dpr: devicePixelRatio
            }, (res) => {
                selection = null;
            });
        });

        $(".kp-screenshot-cancel").on("click", function(event) {
            overlay(false);
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
    console.log("inside inject");
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

    injectConfirmBox("Do you want to upload a template?", doCrop, noCrop);
    return true;
}

function injectConfirmBox(text, yesCb, noCb) {
    const append =
        `<div class="kp-popup kp-is-visible" role="alert">
    <div class="kp-popup-container">
    <p>${text}</p>
    <div class="kp-buttons">
    <div><a href="#0" class="kp-yes">Yes</a></div>
    <div><a href="#0" class="kp-no">No</a></div>
    </div>
    <div="#0" class="kp-popup-close"><div>
    </div>
</div>`;

    $("body .kp-popup").remove();
    $("body").append(append);
    $(".kp-popup").on("click", function(event) {
        if ($(event.target).is(".kp-popup-close") || $(event.target).is(".kp-popup")) {
            event.preventDefault();
            $(this).removeClass("kp-is-visible");
        } else if ($(event.target).is(".kp-yes")) {
            event.preventDefault();
            $(this).removeClass("kp-is-visible");
            if (yesCb) {
                yesCb();
            }
        } else if ($(event.target).is(".kp-no")) {
            event.preventDefault();
            if (noCb) {
                noCb();
            }
            $(this).removeClass("kp-is-visible");
        }
    });
    //close popup when clicking the esc keyboard button
    $(document).keyup(function(event) {
        if (event.which === "27") {
            $(".kp-popup").removeClass("kp-is-visible");
        }
    });
}
