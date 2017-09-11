const tabinfo = {};
const watches = [0, 4000, 20000];
const WATCHDOG_INTERVAL = 1000; /* How often to run the redflag watchdog */
const STATES = ["init", "watching", "safe", "greenflagged", "redflagged", "red_done"];
const END_STATES = ["safe", "greenflagged", "redflagged", "red_done"];
const DEFAULT_IMG = chrome.extension.getURL("assets/img/secure_img/kp3.jpg");
var update_flag = false;

let DEBUG = true, basic_mode = false,
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
    setIcon(id,"init");
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
        removeFromWhiteList(msg.site, msg.currentTab);
        respond({message: "removed"});
    } else if (msg.op === "crop_capture") {
        chrome.tabs.query({active: true, currentWindow: true}, (tab) => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, (image) => {
                crop(image, msg.area, msg.dpr, true, (cropped) => {
                    let cb = function(res) {
                        if (res) {
                            respond({message: "cropped", image: cropped});
                        } else {
                            respond({message: "failed", err: "few_corners"});
                        }
                    };

                    addToWhiteList(sender.tab, cropped, cb);
                });
            });
        });
    } else if (msg.op === "add_wh") {
        respond({message: "Added"});
        addToWhiteList(sender.tab, null);
    } else if (msg.op === "add_skip") {
        let domain = getPathInfo(sender.tab.url).host;
        addToKPSkipList(domain);
        respond({message: "added"});
    } else if (msg.op === "urgent_check") {
        respond({action: "nop"});
        let tabState = tabinfo[sender.tab.id].state;
        if (tabState === "watching" || tabState === "init") {
            redflag(tabinfo[sender.tab.id]);
        }
    } else {
        console.log("KPBG: Unknown message", msg);
    }
    return true;
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
        ti.inputFields = msg.inputFields;
        let res = checkWhitelist(tab);
        if (res) {
            let greenFlag = true;
            if (res.green_check) {
                let rules = res.green_check;
                for ( let key in rules) {
                    if (!ti.inputFields[key] || ti.inputFields[key] !== rules[key]) {
                        greenFlag = false;
                        break;
                    }
                }
            }
            if (greenFlag) {
                respond({action: "nop"});
                ti.state = "greenflagged";
                setIcon(tab.id, "greenflagged", {site: res.site});
                ti.port.postMessage({op: "greenflag", site: res.site});
                return;
            }
        }
    }

    if (checkSkip(tab.url)) {
        ti.state = "safe";
        setIcon(tab.id, "safe");
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
    if (msg.data && !ti.checkState && (ti.state !== "greenflagged" || ti.state !== "redflagged")) {
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
    let res = checkWhitelist(tab);
    if (ti.state !== "greenflagged" && res) {
        debug("greenflagging after url change", tab.id, tab.url);
        ti.state = "greenflagged";
        setIcon(ti.tab.id, "greenflagged", {site: res.site});
        ti.port.postMessage({op: "greenflag", site: res.site});
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
        setIcon(ti.tab.id, "red_done");
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
    const wl = KPWhiteList.filter(x => x.enabled && x.url.filter(y => y.url === site).length > 0);
    if (wl.length) {
        debug("WHITE LISTED:", wl[0]);
        const wl_url = wl[0].url.filter(x => x.url === site);
        return {"site":wl[0].site, "green_check": wl_url[0].green_check};
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
                let t0 = performance.now();
                for (let i = 0; i < KPTemplates.length; i++) {
                    const template = KPTemplates[i];
                    if (template.enabled) {
                        const res = matchOrbFeatures(scrCorners, scrDescriptors, template.patternCorners,
                            template.patternDescriptors, template.site);
                        if (res) {
                            let t1 = performance.now();
                            console.log("Match found for : " + template.site , " time taken : " + (t1-t0) + "ms", Date());
                            ti.state = "redflagged";
                            setIcon(tab.id, "redflagged", {site: template.site});
                            findCorrespondence(normalizedImage, scrCorners , template, res.matches, res.matchCount,
                                res.mask, img => ti.port.postMessage({op: "redflag", site: template.site, img:img}));
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
    if (details.reason === "update") {
        update_flag = true;
    }
});

/* Indexed DB related functions */

function runUpdate(dbData) { 
    defPatterns.forEach((x) => {
        let index = dbData.findIndex((y) => {
            return y.site === x.site;
        });
        if (index != -1) {
            x.templates.forEach((t) => {
                let tempIndex = dbData[index].templates.findIndex((ind) => {
                    return t.templateName === ind.templateName;
                });
                if (tempIndex === -1) {
                    dbData[index].templates.push(t);
                }
            });
            x.url.forEach((u) => {
                let urlIndex = dbData[index].url.findIndex((ind) => {
                    return u.url === ind.url
                });
                if (urlIndex === -1) {
                    dbData[index].url.push(u);
                }
            });
        } else {
            dbData.push(x);
        }
    });
    skipDomains.forEach((x) => {
        let index = KPSkipArray.findIndex((i) => {
            return x.name === i.name;
        });
        if (index !== -1){
            x.domains.forEach((y) => {
                if (!KPSkipArray[index].domains.includes(y)) {
                    KPSkipArray[index].domains.push(y);
                }
            });
        } else {
            KPSkipArray.push(x);
        }
    });
    saveKPSkipList();
    objWhitelist.putBatch(dbData, syncWhiteList);
}

function initWhitelist() {
    objWhitelist.getAll((data) => {
        if (data.length <= 0) {
            objWhitelist.putBatch(defPatterns, syncWhiteList);
        } else if (update_flag) {
            runUpdate(data);
        } else {
            syncWhiteList();
        }
    });
}

function syncWhiteList(cb){
    objWhitelist.getAll(function (dbObj){
        debug("Object retrived from indexed DB : ", dbObj);
        var data1 = dbObj.map((x) => {
            return {id: x.id, url: x.url, type: x.type, site: x.site, templates: x.templates, enabled: x.enabled};
        });
        if (cb && typeof(cb) === "function") {
            cb(data1);
            return;
        }
        var res = [];
        dbObj.forEach((x) => {
            x.templates.forEach((y) => {
                let temp = {};
                temp.id = x.id;
                temp.url = x.url;
                temp.type = x.type;
                temp.site = x.site;
                temp.enabled = x.enabled;
                Object.assign(temp, y);
                res.push(temp);
            });
        });
        KPTemplates = res.filter((x) => {
            return x.logo !== undefined && x.enabled === true;
        }).map((x) => {
            return {id: x.id, url: x.url, site: x.site, logo: x.logo, enabled: x.enabled, patternCorners: x.patternCorners, patternDescriptors: x.patternDescriptors};
        });
        KPWhiteList = dbObj.filter((x) => {
            return x.url !== undefined;
        }).map((x) => {
            return {id: x.id, url: x.url, type: x.type, enabled: x.enabled, site: x.site, domains: x.domains, green_check: x.green_check};
        });

        debug("syncWhiteList called : ", KPWhiteList, KPTemplates);
    });
}

function removeFromWhiteListById(id) {
    objWhitelist.remove(id, syncWhiteList);
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

function addToWhiteList(tab, logo, cb) {
    let url = stripQueryParams(tab.url),
        site = getPathInfo(url).host,
        pattern = {};
    pattern.patternName = site;
    pattern.url = url;
    let addToDb = function(pattern) {
        let data = { type: "custom", site: site, enabled: true};
        data.templates = [];
        data.templates.push(pattern);
        data.domains = [];
        data.domains.push(data.site);
        data.url = [];
        data.url.push({url: url});
        tabinfo[tab.id].state = "greenflagged";
        setIcon(tab.id, "greenflagged", {site: site});
        addToKPSkipList(site, true);
        objWhitelist.put(data, (x) => {
            syncWhiteList();
            debug("Added to DB : ", x);
        });
    };

    let appendToDb = function(pattern, index) {
        let id = KPWhiteList[index].id;
        var onSuccess = function(obj) {
            obj.url.push( { url: url} );
            obj.templates.push(pattern);
            objWhitelist.put(obj, syncWhiteList);
            tabinfo[tab.id].state = "greenflagged";
            setIcon(tab.id, "greenflagged", {site: site});
            addToKPSkipList(site, true);
        };
        var onError = function(error) {
            console.log("Error updating field : ", error);
            return;
        };
        objWhitelist.get(id, onSuccess, onError);
    };


    var isSiteAdded = KPWhiteList.findIndex((x) => {
        let y = x.domains.filter((z) => {
            return site.endsWith(z);
        });
        if (y.length > 0) {
            return true;
        }
        return false;
    });

    if (logo) {
        createPatterns(logo).then(function(result) {
            console.log("Template promise result : ", result);
            pattern.logo = logo;
            pattern.patternCorners = result.patternCorners;
            pattern.patternDescriptors = result.patternDescriptors;
            if (isSiteAdded !== -1) {
                appendToDb(pattern, isSiteAdded);
            } else {
                addToDb(pattern);
            }
            if (cb !== undefined || cb !== null) {
                cb(true);
            }
        }).catch((e) => {
            console.log(e);//promise rejected.
            if (cb !== undefined || cb !== null) {
                cb(false);
            }
            return;
        });
    } else {
        if (isSiteAdded !== -1) {
            appendToDb(pattern, isSiteAdded);
        } else {
            addToDb(pattern);
        }
    }
}

function removeUrlFromWhiteList(url, id) {
    var onSuccess = function(data) {
        let j = data.url.findIndex((x) => {
            return x.url === url;
        });
        if (data.type === "custom" && data.url.length > 1) {
            data.url.splice(j, 1);
            let ti = data.templates.findIndex((x) => {
                return x.url === url;
            });
            console.log("template found : ", ti);
            if (ti !== -1) {
                data.templates.splice(ti, 1);
            }
        } else {
            data.url.splice(j, 1);
        }

        objWhitelist.put(data, syncWhiteList);
    };
    var onError = function(error) {
        console.log("Error updating field : ", error);
        return;
    };
    objWhitelist.get(id, onSuccess, onError);
}

function removeFromWhiteList(site, tab) {
    let upsertInDb = function(id) {
        var onSuccess = function(obj) {
            let i = obj.url.findIndex((x) => {
                return x.url === site;
            });
            if (i === -1) {
                return;
            }
            obj.url.splice(i, 1);
            let ti = obj.templates.findIndex((x) => {
                return x.url === site;
            });
            if (ti !== -1) {
                obj.templates.splice(ti, 1);
            }
            objWhitelist.put(obj, syncWhiteList);
        };
        var onError = function(error) {
            console.log("Error updating field : ", error);
            return;
        };
        objWhitelist.get(id, onSuccess, onError);
    };

    let found = KPWhiteList.filter((x) => {
        return (x.url.filter(y => y.url === site)).length > 0;
    });
    if (found.length > 0) {
        if (found[0].url.length > 1) {
            upsertInDb(found[0].id);
        } else {
            removeFromKPSkipList(getPathInfo(site).host);
            objWhitelist.remove(found[0].id, syncWhiteList);
            debug("Removed from whitelist : ", site);
        }
        tabinfo[tab.id].state = "red_done";
        setIcon(ti.tab.id, "red_done");
        tabinfo[tab.id].checkState = false;
    } else {
        debug("site not Whitelisted : ", site);
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
        debug("Data received : ", data);
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

function setDefaultSecurityImage(cb) {
    chrome.storage.local.get("secure_img", function(result) {
        var data = result.secure_img;
        if (typeof data === "undefined") {
            data = {};
            data.type = "default";
            data.src = DEFAULT_IMG;
            chrome.storage.local.set({ "secure_img": data }, cb);
        } else {
            return;
        }
    });
}
    
function loadDefaults() {
    initAdvConfigs();
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


function addToKPSkipList(domain, isWhitelisted = false) {
    console.log("addToSkipList Callled");
    if (KPSkipList.indexOf(domain) !== -1) {
        console.log("Skiplist adding failed");
        return ("Domain already present in skiplist");
    }
    var obj = {};
    obj.site = domain;
    obj.whiteListed = isWhitelisted;
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
        return {site: x.site, whitelisted: x.whiteListed };});
}


function cleanDB() {
    chrome.storage.local.remove(["skiplist", "secure_img"], () => {
        console.log("skiplist cleaned up");
    });
    objWhitelist.clear(loadDefaults);
}

function initAdvConfigs() {
    chrome.storage.local.get("adv_config", function(result) {
        var data = result.adv_config;
        debug("Data received : ", data);
        if (data) {
            DEBUG = data.debug? true : false;
            basic_mode = data.basic_mode ? true : false;
        } else {
            DEBUG = false;
            basic_mode = false;
            saveAdvConfig();
        }
    });
}

function saveAdvConfig() {
    chrome.storage.local.set({adv_config : {debug: DEBUG, basic_mode: basic_mode}});
}

function setDebugFlag(enable) {
    DEBUG = enable;
    saveAdvConfig();
}

function getDebugFlag() {
    return DEBUG;
}

function setBsicMode(enable) {
    basic_mode = enable;
    saveAdvConfig();
}

function getBsicMode() {
    return basic_mode;
}

function setIcon(tabId, state, info) {
    const iconFolder = "assets/icons";
    let iconPath = iconFolder + "/icon24.png";
    let title = "Page not tested";
    switch (state) {
        case "safe":
            title = "Page belongs to safe domain";
            iconPath = iconFolder + "/icon24-green.png";
            break;
        case "greenflagged":
            title = "Protected page verified: " + info.site;
            iconPath = iconFolder + "/icon24-green.png";
            break;
        case "redflagged":
            title = "Possible phishing: looks like " + info.site;
            iconPath = iconFolder + "/icon24-red.png";
            break;
        case "red_done":
            title = "Page tested, appears clean";
            iconPath = iconFolder + "/icon24-blue.png";
            break;
    }

    chrome.browserAction.setIcon({
        path: iconPath,
        tabId: tabId
    });

    chrome.browserAction.setTitle({
        title: title,
        tabId: tabId
    });
}
