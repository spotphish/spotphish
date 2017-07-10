const tabinfo = {};
const watches = [0, 4000, 12000, 30000];
const WATCHDOG_INTERVAL = 1000; /* How often to run the redflag watchdog */

let debug = false, 
    globalCurrentTabId,
    tabInfoList = {},
    KPWhiteList,
    KPSkipList,
    KPRedFlagList;

chrome.runtime.onConnect.addListener(port => {
    const id = port.sender.tab.id;
    updateTabinfo(id, port.sender.tab);
    tabinfo[id].port = port;

});

setInterval(watchdog, WATCHDOG_INTERVAL);

function updateTabinfo(id, tab) {
    if (!tabinfo[id] || tab.url !== tabinfo[id].tab.url) {
        tabinfo[id] = {state: "init", tab, watches: []};
    } else {
        tabinfo[id].tab = tab;
    }
}

function saveKPWhiteList() {
    chrome.storage.local.set({whitelist : KPWhiteList},() => {
        console.log("whitelist : ", KPWhiteList )
        });
}

function saveKPRedFlagList() {
    chrome.storage.local.set({redflaglist : KPRedFlagList},() => {
        console.log("redflaglist : ", KPRedFlagList )
        });
}

function saveKPSkipList() {
    chrome.storage.local.set({skiplist : KPSkipList},() => {
        console.log("skiplist : ", KPSkipList )
        });
}

function syncWhiteList(){
    chrome.storage.local.get("whitelist", function(result) {
        var data = result.whitelist;
            console.log("Data received : ", data );
            if (data) {
                KPWhiteList = data;
            } else {
                KPWhiteList = whiteListedURLs;
                saveKPWhiteList();
            }
    });
}

function syncSkipList(){
    chrome.storage.local.get("skiplist", function(result) {
        var data = result.skiplist;
            console.log("Data received : ", data );
            if (data) {
                KPSkipList = data;
            } else {
                KPSkipList = skipDomains;
                saveKPSkipList();
            }
    });
}

function syncRedFlagList(){
    chrome.storage.local.get("redflaglist", function(result) {
        var data = result.redflaglist;
            console.log("Data received : ", data );
            if (data) {
                KPRedFlagList = data;
            } else {
                ajax_get('/assets/defaults/pattern.json', function(err, jsonData) {
                    if (err == null) {
                        console.log(jsonData);
                        KPRedFlagList = jsonData
                        saveKPRedFlagList();
                    }
                    else {
                        console.log(err);
                    }
                });
            }
    });
}

function loadDefaults() {
    syncWhiteList();
    syncSkipList();
    syncRedFlagList();
}

function addToKPWhiteList(site) {
    if (site in KPWhiteList) {
        return;
    }
    KPWhiteList.push(site);
    saveKPWhiteList();
}

function addToKPSkipList(domain) {
    if (domain in KPSkipList) {
        return;
    }
    KPSkipList.push(domain);
    saveKPSkipList();
}

function removeFromKPWhiteList(site) {
    var index = KPWhiteList.indexOf(site);
    if (index !== -1) {
        KPWhiteList.splice(index,1);
        saveKPWhiteList();
    } else {
        console.log("site not Whitelisted : ", site);
    }
}

function removeFromKPSkipList(domain) {
    var index = KPSkipList.indexOf(domain);
    if (index !== -1) {
        KPSkipList.splice(index,1);
        saveKPSkipList();
    } else {
        console.log("Domain not in skip list : ", domain);
    }
}

function removeFromKPRedFlagList(domain) {
    var index = KPRedFlagList.indexOf(domain);
    if (index !== -1) {
        KPRedFlagList.splice(index,1);
        saveKPRedFlagList();
    } else {
        console.log("Domain not in red flag list : ", domain);
    }
}
chrome.runtime.onMessage.addListener(function(msg, sender, respond) {
    if (sender.tab) {
        updateTabinfo(sender.tab.id, sender.tab);
    }
    if (msg.op === "init") {
        init(msg, sender, respond);
    } else if (msg.op === "checkdata") {
        checkdata(msg, sender, respond);
    } else if (msg.op === 'get_tabinfo') {
        var tab = msg.curtab;
        if (tabinfo[tab.id] && tabinfo[tab.id].tab.url === tab.url) {
            respond({status: tabinfo[tab.id].state});
        } else {
            respond({status: tab_status.NA});
        }

    } else if (msg.op === 'addToWhitelist') {
        addToKPWhiteList(msg.site);
    } else if (msg.op === 'removeFromWhitelist') {
        removeFromKPWhiteList(msg.site);
    }else {
        console.log("KPBG: Unknown message", msg);
    }
});

function init(msg, sender, respond) {
    const ti = tabinfo[sender.tab.id],
        tab = ti.tab;
    console.log("init", sender.tab, Date());
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

function checkdata(msg, sender, respond) {
    respond({action: "nop"});
    const ti = tabinfo[sender.tab.id];
    console.log("checkdata tab info : ", ti);
    assert("checkdata.1", ti.state === "checking");
    if (msg.data) {
        ti.state = "watching";
        const now = Date.now();
        ti.watches = watches.map(x => now + x);
        console.log("WATCHING", Date());
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
    console.log("SNAP! ", Date(), ti.tab.id, ti.tab.url, ti.state, ti.watches);
    snapcheck(ti);
    if (ti.watches.length === 0) {
        ti.state = "red_done";
    }
}

function checkSkip(url) {
    let length = KPSkipList.length;
    let urlInfo = getPathInfo(url);
    if (urlInfo.protocol === "https:") {
        for (let i = 0; i < length; i++ ) {
            if (urlInfo.host.endsWith(KPSkipList[i])) {
                console.log("SKIP LISTED : ", KPSkipList[i]);
                return true;
            }
        }
    }
    console.log(" NOT SKIP LISTED : ", url);
    return false;
}

function checkWhitelist(tab) {
    let urlData = getPathInfo(tab.url);
	if (urlData.protocol === "https:") {
		let site = urlData.protocol +"//" + urlData.host;
		if (urlData.port) {
			site = site + ":" + urlData.port;
		}
		site = site + urlData.path;
		for (var i = 0; i < KPWhiteList.length; i++ ) {
			if (site === KPWhiteList[i]) {
				console.log("WHITE LISTED : ", KPWhiteList[i]);
				return true;
			}
		}
    }
    console.log(" NOT WHITE LISTED : ", tab.url);
    return false;
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
                    console.log("Match found, time taken : " + (t1-t0) + " ms", Date());
                    ti.state = "redflagged";
                    ti.port.postMessage({op: "redflag", site: site});
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

chrome.runtime.onInstalled.addListener(function(details) {
if (details.reason === 'install') {
        chrome.tabs.create({ url: "option.html" });
    }
});
loadDefaults();
