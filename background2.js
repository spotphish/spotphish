const tabinfo = {};
const watches = [2000, 5000, 10000, 20000];
const WATCHDOG_INTERVAL = 1000; /* How often to run the redflag watchdog */

chrome.runtime.onConnect.addListener(port => {
    const id = port.sender.tab.id;
    updateTabinfo(id, port.sender.tab);
    tabinfo[id].port = port;

});

syncRedFlagList();
setInterval(watchdog, WATCHDOG_INTERVAL);

function updateTabinfo(id, tab) {
    if (!tabinfo[id] || tab.url !== tabinfo[id].tab.url) {
        tabinfo[id] = {state: "init", tab, watches: []};
    } else {
        tabinfo[id].tab = tab;
    }
}

chrome.runtime.onMessage.addListener(function(msg, sender, respond) {
    updateTabinfo(sender.tab.id, sender.tab);
    if (msg.op === "init") {
        init(msg, sender, respond);
    } else if (msg.op === "checkinfo") {
        checkinfo(msg, sender, respond);
    } else {
        console.log("KPBG: Unknown message", msg);
    }
    //console.log("BACKGROUND GOT", msg, sender);
});

function init(msg, sender, respond) {
    const ti = tabinfo[sender.tab.id],
        tab = ti.tab;
    console.log("init", sender.tab);
    if (msg.top) {
        ti.state = "init";
        ti.watches = [];
        ti.dpr = msg.dpr;
    }
    if (checkWhitelist(tab)) {
        respond({action: "nop"});
        if (msg.top && tab.state !== "greenflagged") {
            ti.state = "greenflagged";
            ti.port.postMessage({op: "greenflag", data: {}});
        }
        return;
    }
        
    if (checkSkip(tab.url)) {
        ti.state = "safe";
        return respond({action: "nop"});
    }
    
    ti.state = "checking";
    return respond({action: "check"});
}

function checkinfo(msg, sender, respond) {
    respond({action: "nop"});
    const ti = tabinfo[sender.tab.id];
    assert("checkinfo.1", ti.state === "checking");
    if (msg.data) {
        ti.state = "watching";
        const now = Date.now();
        ti.watches = watches.map(x => now + x);
    }
}

/* Runs once a second */
function watchdog() {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        for (const x in tabinfo) {
            const ti = tabinfo[x];
            console.log("TAB", ti.tab.id, ti.tab.url, ti.state);
        }
        if (!tabs.length) return;
        const id = tabs[0].id,
            ti = tabinfo[id] || {};
        const now = Date.now();
        if (ti.state === "watching") {
            assert("watchdog.1", ti.watches.length > 0);
            let check = false;
            while (ti.watches.length && now > ti.watches[0]) {
                check = true;
                ti.watches.shift();
            }
            if (check) {
                redflag(ti);
            }
        }
    });
}

function redflag(ti) {
    console.log("SNAP! ", ti.tab.id, ti.tab.url, ti.state, ti.watches);
    snapcheck(ti);
    if (ti.watches.length === 0) {
        ti.state = "red_done";
    }
}

function checkSkip(url) {
    // XXX
    if (url.match("reddit.com")) {
        return true;
    }
    return false;
}

function checkWhitelist(tab) {
    // XXX
    const url = tab.url;
    if (url.startsWith("https://www.paypal.com/signin")) {
        return true;
    }
}

function snapcheck(ti) {
    const tab = ti.tab;
    chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, image => {
        // image is base64

        var matches = [];
        var scrCorners = [];
        var scrDescriptors = [];
        var normalizedImage;
        const area = {x: 0, y: 0, w: tab.width, h: tab.height};
        //TODO:Resolve/reject promise if no match happens
        crop(image, area, ti.dpr, false, cropped => {
            normalizedImage = cropped;
            Promise.all([findOrbFeatures(normalizedImage)]).then((results) => {
                scrCorners = results[0].corners;
                scrDescriptors = results[0].descriptors;
                KPRedFlagList.forEach(function (value) {
                    if (value.enabled) {
                        matches.push(matchOrbFeatures(
                                            scrCorners,
                                            scrDescriptors,
                                            value.patternCorners,
                                            value.patternDescriptors,
                                            value.site
                                            ));
                    }
                });

                let t0 = performance.now();
                Promise.race(matches).then((site) => {
                    // console.log("After promise");
                    let t1 = performance.now();
                    console.log("Match found, time taken : " + (t1-t0) + " ms");
                    ti.port.postMessage({op: "redflag", site: site});
                    ti.state = "redflagged";
                })
                .catch((e) => {
                    console.log(e);//promise rejected.
                });
            });
        });
    });
}

chrome.tabs.onRemoved.addListener((tabid, removeinfo) => {
    console.log("removing tab", tabid);
    if (tabinfo[tabid]) {
        delete tabinfo[tabid];
    }
});

let KPRedFlagList;
function syncRedFlagList(){
    ajax_get("/assets/defaults/pattern.json", function(err, jsonData) {
        if (err === null) {
            console.log(jsonData);
            KPRedFlagList = jsonData;
        }
        else {
            console.log(err);
        }
    });
}
