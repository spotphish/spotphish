const tabinfo = {};
const watches = [0, 4000, 20000];
const WATCHDOG_INTERVAL = 1000; /* How often to run the redflag watchdog */
const STATES = ["init", "watching", "safe", "greenflagged", "redflagged", "red_done"];
const END_STATES = ["safe", "greenflagged", "redflagged", "red_done"];

let debug = false, 
    globalCurrentTabId,
    tabInfoList = {},
    KPWhiteList,
    KPSkipList,
    KPTemplates,
    objWhitelist;

loadDefaults();

chrome.runtime.onConnect.addListener(port => {
    const id = port.sender.tab.id;
    initTabinfo(id, port.sender.tab);
    tabinfo[id].port = port;

});

function initTabinfo(id, tab) {
    tabinfo[id] = {
        checkState: false,
        topReady: false,
        state: "init",
        tab,
        watches: [],
        dpr: 1,
        port: null
    };
}

setInterval(watchdog, WATCHDOG_INTERVAL);

     
function updateTabinfo(id, tab) {
    tabinfo[id].tab = tab;
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
        inject(msg.currentTab, msg.site);
    } else if (msg.op === 'removeFromWhitelist') {
        removeFromWhiteList(msg.site);
    } else if (msg.op === 'crop_capture') {
        console.log("Inside crop capture");
        chrome.tabs.getSelected(null, (tab) => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (image) => {
                crop(image, msg.area, msg.dpr, true, (cropped) => {
                        respond({message: 'image', image: cropped});
                        var url = stripQueryParams(sender.tab.url);
                        console.log ("URL: ", url, " tab: ", sender.tab);
                        addToWhiteList({ url: url, type: "custom", logo: cropped, site: getPathInfo(url).host, enabled: true}, sender.tab);
                })
            })
        })
    } else if (msg.op === 'add_wh') {
        var url = stripQueryParams(sender.tab.url);
        console.log ("URL: ", url, " tab: ", sender.tab);
        addToWhiteList({ url: url, type: "custom", site: getPathInfo(url).host, enabled: true}, sender.tab);
    } else {
        console.log("KPBG: Unknown message", msg);
    }
});

function inject (tab, site) {
    chrome.tabs.sendMessage(tab.id, {message: 'init', url: site});
}

function init(msg, sender, respond) {
    const ti = tabinfo[sender.tab.id],
        tab = ti.tab;
    console.log("init", tab.id, tab.url, msg.top ? "top" : "iframe", Date());

    if (END_STATES.indexOf(ti.state) !== -1) {
        return respond({action: "nop"});
    }

    if (msg.top) {
        ti.dpr = msg.dpr;
        ti.topReady = true;
    }
    if (checkWhitelist(tab)) {
        respond({action: "nop"});
        if (msg.top) {
            ti.state = "greenflagged";
            ti.port.postMessage({op: "greenflag", data: {}});
        }
        return;
    }

    if (checkSkip(tab.url)) {
        ti.state = "safe";
        return respond({action: "nop"});
    }

    if (!ti.checkState) {
        return respond({action: "check"});
    }
    return respond({action: "nop"});
}

function checkdata(msg, sender, respond) {
    respond({action: "nop"});
    const ti = tabinfo[sender.tab.id];
    if (msg.data && !ti.checkState) {
        ti.checkState = true;
        ti.state = "watching";
        const now = Date.now();
        ti.watches = watches.map(x => now + x);
        console.log("WATCHING", Date());
    }
}

function watchdog() {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        if (debug) {
            for (const x in tabinfo) {
                const ti = tabinfo[x];
                assert("watchdog.1", STATES.indexOf(ti.state) !== -1, ti.state);
                console.log("TAB", ti.tab.id, ti.tab.url, ti.state);
            }
        }
        if (!tabs.length) return;
        const id = tabs[0].id,
            ti = tabinfo[id] || {};
        const now = Date.now();
        if (ti.state === "watching" && ti.topReady) {
            assert("watchdog.2", ti.watches.length > 0);
            let redcheck = false;
            while (ti.watches.length && now > ti.watches[0]) {
                redcheck = true;
                ti.watches.shift();
            }
            if (redcheck) {
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
			if (site === KPWhiteList[i].url) {
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
        crop(image, area, ti.dpr, false, cropped => {
            normalizedImage = cropped;
            Promise.all([findOrbFeatures(normalizedImage)]).then((results) => {
                scrCorners = results[0].corners;
                scrDescriptors = results[0].descriptors;
                console.log("KPTemplates : ", KPTemplates);
                KPTemplates.forEach(function (value) {
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
    if (tabinfo[tabid]) {
        delete tabinfo[tabid];
    }
});

chrome.runtime.onInstalled.addListener(function(details) {
if (details.reason === 'install') {
        chrome.tabs.create({ url: "option.html" });
    }
});

/* Indexed DB related functions */

function initWhitelist() {
    objWhitelist.getAll((data) => {
        if (data.length <= 0) {
            getDefaultWhitelist().then(patternData => {
                objWhitelist.putBatch(patternData, syncWhiteList);
            });
        }
    })
}

function syncWhiteList(cb){
    objWhitelist.getAll((data) => {
        var data1 = data.map((x) => {
            return {id: x.id, url: x.url, type: x.type, site: x.site, logo: x.logo, enabled: x.enabled}
        });

        KPTemplates = data.filter((x) => {
            return x.logo !== undefined && x.enabled === true;
        }).map((x) => {
            return {id: x.id, url: x.url, site: x.site, logo: x.logo, enabled: x.enabled, patternCorners: x.patternCorners, patternDescriptors: x.patternDescriptors}
        });
        KPWhiteList = data1.filter((x)=> {
            return x.url !== undefined;
        }).map((x) => {
            return {id: x.id, url: x.url, type: x.type, enabled: x.enabled};
        });
        if (typeof(cb) === 'function') {
            cb(data1);
        }
        console.log("syncWhiteList called : ", KPWhiteList, KPTemplates);
    })
}

function removeFromWhiteListById(id) {
    objWhitelist.remove(id);
}

function addToWhiteList(data, tab) {
    if (data.logo) {
        createPatterns(data.logo).then(function(result) {
            console.log("Template promise result : ", result);
            data.patternCorners = result.patternCorners;
            data.patternDescriptors = result.patternDescriptors;
            objWhitelist.put(data, (x) => {
                syncWhiteList();
                console.log("Add: ", x);
            });
        }).catch((e) => {
            console.log(e);//promise rejected.
            return;
        });
    } else {
        objWhitelist.put(data, (x) => {
            syncWhiteList();
            console.log("Add: ", x);
        });
    }

    tabinfo[tab.id].state = "greenflagged";
}

function removeFromWhiteList(site) {
    console.log("removeFromWhiteList called for : ", site);
    let index = 0;
    let found = false;
    for (index; index < KPWhiteList.length; index++) {
        if (KPWhiteList[index].url === site && KPWhiteList[index].type === 'custom') {
            found = true;
            break;
        }
    }
    if (found) {
        objWhitelist.remove(KPWhiteList[index].id, syncWhiteList);
    } else {
        console.log("site not Whitelisted : ", site);
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

function getDefaultWhitelist(){
    return new Promise((resolve, reject) => {
        ajax_get('/assets/defaults/pattern.json', function(err, jsonData) {
            return (err === null ? resolve(jsonData) : reject(err));
        });
    });
}

function error(err) {
    console.log(err);
}

function loadDefaults() {
    syncSkipList();
    //TODO
    //Should we allow users to add multiple entries for the same site?
    objWhitelist = new IDBStore({
            storeName: 'whitelist',
            keyPath: 'id',
            autoIncrement: true,
            onStoreReady: initWhitelist,
            onError: error,
            indexes: [
                { name: 'url', keyPath: 'url', unique: false, multiEntry: false }
            ]
    });
    //TODO:This is bad, should be replaced
    setTimeout(syncWhiteList, 2000);
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
