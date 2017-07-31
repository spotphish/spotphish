const tabinfo = {};
const watches = [0, 4000, 20000];
const WATCHDOG_INTERVAL = 1000; /* How often to run the redflag watchdog */
const STATES = ["init", "watching", "safe", "greenflagged", "redflagged", "red_done"];
const END_STATES = ["safe", "greenflagged", "redflagged", "red_done"];
const DEFAULT_IMG = chrome.extension.getURL("assets/img/secure_img/kp1.jpg");

let DEBUG = true, 
    globalCurrentTabId,
    tabInfoList = {},
    KPWhiteList,
    KPSkipList,
    KPTemplates,
    KPSkipArray,
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
    } else if (msg.op === "url_change") {
        url_change(msg, sender, respond);
    } else if (msg.op === "get_tabinfo") {
        var tab = msg.curtab;
        if (tabinfo[tab.id] && tabinfo[tab.id].tab.url === tab.url) {
            respond({status: tabinfo[tab.id].state});
        } else {
            respond({status: "NA"});
        }

    } else if (msg.op === "addToWhitelist") {
        console.log("addToWhitelist handled");
        inject(msg.currentTab, msg.site);
        respond({message: "whitelisted"});
    } else if (msg.op === "removeFromWhitelist") {
        removeFromWhiteList(msg.site, sender.tab);
        respond({message: "removed"});
    } else if (msg.op === "crop_capture") {
        chrome.tabs.getSelected(null, (tab) => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, (image) => {
                crop(image, msg.area, msg.dpr, true, (cropped) => {
                    respond({message: "image", image: cropped});
                    var url = stripQueryParams(sender.tab.url);
                    console.log ("URL: ", url, " tab: ", sender.tab);
                    addToWhiteList({ url: [url], type: "custom", logo: cropped, site: getPathInfo(url).host, enabled: true}, sender.tab);
                });
            });
        });
    } else if (msg.op === "add_wh") {
        var url = stripQueryParams(sender.tab.url);
        console.log ("URL: ", url, " tab: ", sender.tab);
        addToWhiteList({ url: [url], type: "custom", site: getPathInfo(url).host, enabled: true}, sender.tab);
    } else if (msg.op === "add_skip") {
        let domain = getPathInfo(sender.tab.url).host;
        addToKPSkipList(domain);
        respond({message: "added"});
    } else {
        console.log("KPBG: Unknown message", msg);
    }
});

function inject (tab, site) {
    let found = KPWhiteList.filter((x) => {
        return x.url === site;
    });
    let ti = tabinfo[tab.id];
    if (found.length == 0) {
        ti.port.postMessage({op: "crop_template", data: {}});
    } else {
        ti.port.postMessage({op: "crop_duplicate", data: {}});//This should ideally never happen
    }
}


function init(msg, sender, respond) {
    const ti = tabinfo[sender.tab.id],
        tab = ti.tab;
    console.log("init", tab.id, tab.url, msg.top ? "top" : "iframe", msg, Date());

    if (END_STATES.indexOf(ti.state) !== -1) {
        return respond({action: "nop"});
    }

    if (msg.top) {
        ti.dpr = msg.dpr;
        ti.topReady = true;
        if (checkWhitelist(tab)) {
            respond({action: "nop"});
            debug("greenflagging", tab.id, tab.url);
            ti.state = "greenflagged";
            ti.port.postMessage({op: "greenflag", data: {}});
            return;
        }
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

function url_change(msg, sender, respond) {
    const ti = tabinfo[sender.tab.id],
        tab = ti.tab;

    console.log("url change", tab.url);

    respond({action: "nop"});
    if (ti.state !== "greenflagged" && checkWhitelist(tab)) {
        debug("greenflagging after url change", tab.id, tab.url);
        ti.state = "greenflagged";
        ti.port.postMessage({op: "greenflag", data: {}});
    }
}

function showTabinfo() {
    for (const x in tabinfo) {
        const ti = tabinfo[x];
        console.log("TAB", ti.tab.id, ti.tab.url, ti.state);
    }
}

function watchdog() {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
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
    let urlInfo = getPathInfo(url);
    let found = KPSkipList.filter(x => urlInfo.host.endsWith(x));

    if (found.length > 0) {
        debug("SKIP LISTED:", found[0]);
        return true;
    }
    return false;
}

function checkWhitelist(tab) {
    const site = stripQueryParams(tab.url);
    const wl = KPWhiteList.filter(x => x.enabled && x.url.filter(y => y === site).length > 0);
    if (wl.length) {
        debug("WHITE LISTED:", wl[0]);
        return true;
    }
    return false;
}

function snapcheck(ti) {
    const tab = ti.tab;
    chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, image => {
        // image is base64

        var scrCorners = [];
        var scrDescriptors = [];
        var normalizedImage;
        const area = {x: 0, y: 0, w: tab.width, h: tab.height};
        crop(image, area, ti.dpr, false, cropped => {
            normalizedImage = cropped;
            findOrbFeatures(normalizedImage).then(result => {
                scrCorners = result.corners;
                scrDescriptors = result.descriptors;
                console.log("KPTemplates : ", KPTemplates);
                let t0 = performance.now();
                for (let i = 0; i < KPTemplates.length; i++) {
                    const template = KPTemplates[i];
                    if (template.enabled) {
                        if (matchOrbFeatures(scrCorners, scrDescriptors, template.patternCorners,
                            template.patternDescriptors, template.site)) {
                            let t1 = performance.now();
                            console.log("Match found, time taken : " + (t1-t0) + " ms", Date());
                            ti.state = "redflagged";
                            ti.port.postMessage({op: "redflag", site: template.site});
                            break;
                        }
                    }
                }
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
    if (details.reason === "install") {
        chrome.tabs.create({ url: "option.html" });
    }
});

/* Indexed DB related functions */

function initWhitelist() {
    objWhitelist.getAll((data) => {
        if (data.length <= 0) {
            objWhitelist.putBatch(defPatterns, syncWhiteList);
        } else {
            syncWhiteList();
        }
    });
}

function syncWhiteList(cb){
    objWhitelist.getAll((data) => {
        var data1 = data.map((x) => {
            return {id: x.id, url: x.url, type: x.type, site: x.site, templates: x.templates, enabled: x.enabled};
        });
        console.log("retrieved from index db ", data1);
        if (cb && typeof(cb) === "function") {
            cb(data1);
            return;
        }
        var res = data.map((x) => {
            var j = 0;
            var arr = [];
            x.templates.forEach((i) => {
                arr[j] = x;
                Object.assign(arr[j], i);
                j++;
            });
            return arr;
        }).reduce(function (a,b) {
            return  a.concat(b);
        }, []);
        KPTemplates = res.filter((x) => {
            return x.logo !== undefined && x.enabled === true;
        }).map((x) => {
            return {id: x.id, url: x.url, site: x.site, logo: x.logo, enabled: x.enabled, patternCorners: x.patternCorners, patternDescriptors: x.patternDescriptors};
        });
        KPWhiteList = data1.filter((x)=> {
            return x.url !== undefined;
        }).map((x) => {
            return {id: x.id, url: x.url, type: x.type, enabled: x.enabled};
        });

        console.log("syncWhiteList called : ", KPWhiteList, KPTemplates);
    });
}

function removeFromWhiteListById(id) {
    objWhitelist.remove(id);
}

function toggleWhitelistItems(id, state, cb) {
    var onSuccess = function(data) {
        data.enabled = state;
        objWhitelist.put(data, syncWhiteList);
        if (cb) {
            cb();
        }
    };
    var onError = function(error) {
        console.log("Error updating field : ", error);
        return;
    };
    objWhitelist.get(id, onSuccess, onError);
} 

function addToWhiteList(data, tab) {
    var pattern = {};
    if (data.logo) {
        createPatterns(data.logo).then(function(result) {
            console.log("Template promise result : ", result);
            pattern.logo = data.logo;
            pattern.patternCorners = result.patternCorners;
            pattern.patternDescriptors = result.patternDescriptors;
            pattern.patternName = data.site;
            data.templates = [];
            data.templates.push(pattern);
            objWhitelist.put(data, (x) => {
                syncWhiteList();
                console.log("Add: ", x);
            });
        }).catch((e) => {
            console.log(e);//promise rejected.
            return;
        });
    } else {
        pattern.name = data.site;
        data.templates = [];
        data.templates.push(pattern);
        objWhitelist.put(data, (x) => {
            syncWhiteList();
            console.log("Add: ", x);
        });
    }

    tabinfo[tab.id].state = "greenflagged";
    let urlInfo = getPathInfo(tab.url); 
    addToKPSkipList(urlInfo.host);
}


function removeFromWhiteList(site, tab) {
    let found = KPWhiteList.filter((x) => {
        return (x.url.filter(y => y === site)).length > 0;
    });
    if (found.length > 0) {
        removeFromKPSkipList(getPathInfo(site).host);
        objWhitelist.remove(found[0].id, syncWhiteList);
        console.log("Removed from whitelist : ", site);
    } else {
        console.log("site not Whitelisted : ", site);
    }
}


function saveKPSkipList() {
    chrome.storage.local.set({skiplist : KPSkipArray}, () => {
        console.log("skiplist : ", KPSkipArray);
        syncSkipList();
    });
}


function initSkipList() {
    chrome.storage.local.get("skiplist", function(result) {
        var data = result.skiplist;
        console.log("Data received : ", data);
        if (data) {
            KPSkipArray = data;
            syncSkipList();
        } else {
            KPSkipArray = skipDomains;
            saveKPSkipList();
        }
    });
}


function syncSkipList(){
    chrome.storage.local.get("skiplist", function(result) {
        var data = result.skiplist;
        console.log("Data received : ", data);
        KPSkipArray = data;
        KPSkipList = KPSkipArray.map((x) => {
            return x.domains;
        }).reduce(function (a,b) {
            return a.concat(b);
        }, []);
    });
}


function errorfn(err) {
    console.log("error occured");
}

function setDefaultSecurityImage() {
    chrome.storage.local.get("secure_img", function(result) {
        var data = result.secure_img;
        if (typeof data === "undefined") {
            data = {};
            data.type = "default";
            data.src = DEFAULT_IMG;
            chrome.storage.local.set({ "secure_img": data });
        } else {
            return;
        }
    });
}
    
function loadDefaults() {
    initSkipList();
    setDefaultSecurityImage();
    //TODO
    //Should we allow users to add multiple entries for the same site?
    objWhitelist = new IDBStore({
        storeName: "whitelist",
        keyPath: "id",
        autoIncrement: true,
        onStoreReady: initWhitelist,
        onError: errorfn,
        indexes: [
            { name: "url", keyPath: "url", unique: false, multiEntry: false }
        ]
    });
}


function addToKPSkipList(domain) {
    console.log("addToSkipList Callled");
    if (KPSkipList.indexOf(domain) !== -1) {
        console.log("Skiplist adding failed");
        return ("Domain already present in skiplist");
    }
    var obj = {};
    obj.site = domain;
    obj.domains = [];
    obj.domains.push(domain);
    KPSkipArray.push(obj);
    saveKPSkipList();
}


function removeFromKPSkipList(domain) {
    let found = KPSkipArray.filter((x) => {
        return !domain.endsWith(x.site);
    });
    console.log("Found : ", found);
    if (found.length === KPSkipArray.length) {
        console.log("Domain not in skip list : ", domain);
        return ("Domain not present in skip list");
    } else {
        KPSkipArray = found;
        console.log("Removed from skiplist : ", domain);
        saveKPSkipList();
    }
}

function getKPSkipListSites(cb) {
    console.log("getSkipListSites Callled");
    return KPSkipArray.map((x)=> {
        return x.site; });
}


function cleanDB() {
    chrome.storage.local.remove(["skiplist", "secure_img"], () => {
        console.log("skiplist cleaned up");
    });
    objWhitelist.clear(loadDefaults);
}
