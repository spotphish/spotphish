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
                greenflag(msg);
            } else if (msg.op === "redflag") {
                redflag(msg);
            } else {
                console.log("KP: unknown op", msg);
            }
        });
    }

    rpc({op: "init", top: window === top}).then(x => {
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
    setTimeout(() => {
        console.log("KP: Checking");
        const visible = $("input[type=\"password\"]").filter(":visible").length;
        if (visible) {
            rpc({op: "checkinfo", data: visible});
        } else {
            if (npolls < MAX_POLLS) return startChecking();
        }
    }, POLL_INTERVAL);
}

function greenflag(msg) {
    appendSecureImg();
}

function redflag(msg) {
    coverContainer($("body"), msg.site, "", false, true, true, 0);
}

function appendSecureImg() {
    var prepend = "<div class=\"kp-img-container\">";
    prepend += "<div class=\"FAH_closeButton kp-img-close\">";
    prepend += "<strong> X </strong>";
    prepend += "</div>";
    prepend += "</div>";
    var myPrepend = prepend;
    $("body").prepend(myPrepend);
    chrome.storage.local.get("secure_img", function(result) {
        var data = result.secure_img;
        console.log("Data received : ", data );
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
        //$('.image').empty();
        $(".kp-img-container").append(img);

        $(".kp-img-close").on("click", function(e) {
            e.preventDefault();
            $(".kp-img-container").css("display","none");

        });
    });
        //Search for image from local storage
        //If no data stored in local storage use default img

}

function rpc(msg) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(msg, res => {
            return (res === undefined) ? reject({error: chrome.runtime.lastError}) : resolve(res);
        });
    });
}
