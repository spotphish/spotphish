/*
 * Copyright (C) 2017 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file LICENSE for license details.
 */

const watches = [0, 4000];
const WATCHDOG_INTERVAL = 1000; /* How often to run the redflag watchdog */
const STATES = ["init", "watching", "safe", "greenflagged", "redflagged", "red_done"];
const END_STATES = ["safe", "greenflagged", "redflagged", "red_done"];
const DEFAULT_IMG = chrome.extension.getURL("assets/img/secure_img/kp3.jpg");
const UPDATE_CHECK_INTERVAL = 10 * 60 * 60 * 1000; // 10 hours
var update_flag = false;

let DEBUG = true, basic_mode = false,
    globalCurrentTabId,
    tabInfoList = {};

loadDefaults();
setInterval(checkUpdates, UPDATE_CHECK_INTERVAL);

class Tabinfo {
    constructor(id, tab, port) {
        this.id = id;
        this.checkState = false;
        this.topReady = false;
        this._state = "init";
        this.tab = tab;
        this.watches = [];
        this.dpr = 1;
        this.port = port;
        this.nchecks = 0;
        this.status = "";
        Tabinfo.instances[id] = this;
    }

    get state() {
        return this._state;
    }

    set state(val) {
        //debug("SET", this.id, this.tab.url, `${this._state} --> ${val}`);
        this._state = val;
        return this._state;
    }

    update(tab) {
        this.tab = tab;
    }
}

Tabinfo.instances = {};
Tabinfo.get = function(id) {
    return Tabinfo.instances[id];
};

Tabinfo.remove = function(id) {
    delete Tabinfo.instances[id];
};

/* Dump state for debugging */
Tabinfo.show = function() {
    for (const x in Tabinfo.instances) {
        const ti = Tabinfo.get(x);
        console.log("TAB", ti.tab.id, ti.tab.url, ti.state);
    }
};

chrome.runtime.onConnect.addListener(port => {
    const ti = new Tabinfo(port.sender.tab.id, port.sender.tab, port);
    setIcon(ti, "init");
});

setInterval(watchdog, WATCHDOG_INTERVAL);

chrome.runtime.onMessage.addListener(function(msg, sender, respond) {
    if (sender.tab) {
        const ti = Tabinfo.get(sender.tab.id);
        if (ti) {
            ti.update(sender.tab);
        }
    }
    if (msg.op === "init") {
        init(msg, sender, respond);
    } else if (msg.op === "checkdata") {
        checkdata(msg, sender, respond);
    } else if (msg.op === "url_change") {
        url_change(msg, sender, respond);
    } else if (msg.op === "get_tabinfo") {
        const tab = msg.curtab,
            ti = Tabinfo.get(tab.id);
        if (ti && ti.tab.url === tab.url) {
            respond(ti);
        } else {
            respond({state: "NA"});
        }
    } else if (msg.op === "protect_page") {
        inject(msg.tab);
        respond({message: "whitelisted"});
    } else if (msg.op === "unprotect_page") {
        removeFromProtectedList(msg.tab)
            .then(x => respond({message: "removed"}))
            .catch(x => respond({message: "failed", err: x.message}));
    } else if (msg.op === "crop_capture") {
        chrome.tabs.query({active: true, currentWindow: true}, tab => {
            chrome.tabs.captureVisibleTab(tab.windowId, {format: "png"}, image => {
                let cropped;
                crop(image, msg.area, msg.dpr, true)
                .then(x => cropped = x)
                .then(cropped => addToProtectedList(sender.tab, cropped))
                .then(x => respond({message: "cropped", image: cropped}))
                .catch(x => respond({message: "failed", err: "few_corners"}));
            });
        });
    } else if (msg.op === "protect_basic") {
        addToProtectedList(sender.tab, null)
            .then(x => respond({message: "Added"}))
            .catch(x => respond({message: "failed", err: x.message}));
    } else if (msg.op === "urgent_check") {
        respond({action: "nop"});
        let ti = Tabinfo.get(sender.tab.id);
        let tabState = ti.state;
        if (["watching", "init", "red_done"].indexOf(tabState) !== -1) {
            redflagCheck(ti);
        }
    } else if (msg.op === "test_now") {
        const ti = Tabinfo.get(msg.tab.id);
        redflagCheck(ti, true);
    } else if (msg.op === "remove_site") {
        removeSite(msg.site, respond);
    } else if (msg.op === "toggle_site") {
        toggleSite(msg.site, msg.enable, respond);
    } else if (msg.op === "remove_url") {
        removeURL(msg.url, respond);
    } else if (msg.op === "toggle_url") {
        toggleURL(msg.url, msg.enable, respond);
    } else if (msg.op === "remove_safe_domain") {
        removeSafeDomain(msg.domain, respond);
    } else if (msg.op === "add_safe_domain") {
        addSafeDomain(msg.domain, respond);
    } else {
        console.log("KPBG: Unknown message", msg);
    }
    return true;
});

function inject (tab) {
    let ti = Tabinfo.get(tab.id);
    let found = Sites.getProtectedURL(tab.url);
    if (!found) {
        ti.port.postMessage({op: "crop_template", data: {}});
    } else {
        console.log("Already protected: ", tab.url);
    }
}

function init(msg, sender, respond) {
    const ti = Tabinfo.get(sender.tab.id),
        tab = ti.tab;
    //console.log("init", tab.id, tab.url, msg.top ? "top" : "iframe", msg, Date());
    if (msg.top) console.log("init", tab.id, tab.url, msg.top ? "top" : "iframe", msg, Date());

    if (END_STATES.indexOf(ti.state) !== -1) {
        return respond({action: "nop"});
    }

    if (msg.top) {
        ti.dpr = msg.dpr;
        ti.topReady = true;
        ti.inputFields = msg.inputFields;
        let res = Sites.getProtectedURL(tab.url);
        debug("Result check Protected : ", res);
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
                setIcon(ti, "greenflagged", {site: res.site});
                ti.port.postMessage({op: "greenflag", site: res.site});
                return;
            }
        }
    }

    if (Sites.getSafeDomain(tab.url)) {
        ti.state = "safe";
        setIcon(ti, "safe");
        return respond({action: "nop"});
    }

    if (!ti.checkState) {
        return respond({action: "check"});
    }
    return respond({action: "nop"});
}

function checkdata(msg, sender, respond) {
    respond({action: "nop"});
    const ti = Tabinfo.get(sender.tab.id);
    if (msg.data && !ti.checkState && (ti.state !== "greenflagged" || ti.state !== "redflagged")) {
        ti.checkState = true;
        ti.state = "watching";
        const now = Date.now();
        ti.watches = watches.map(x => now + x);
        console.log("WATCHING", Date());
    }
}

function url_change(msg, sender, respond) {
    const ti = Tabinfo.get(sender.tab.id),
        tab = ti.tab;

    console.log("url change", tab.url);

    respond({action: "nop"});
    let res = Sites.getProtectedURL(tab.url);
    if (ti.state !== "greenflagged" && res) {
        debug("greenflagging after url change", tab.id, tab.url);
        ti.state = "greenflagged";
        setIcon(ti, "greenflagged", {site: res.site});
        ti.port.postMessage({op: "greenflag", site: res.site});
    }
}

function watchdog() {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        if (!tabs.length) return;
        const id = tabs[0].id,
            ti = Tabinfo.get(id) || {};
        const now = Date.now();
        if (ti.state === "watching" && ti.topReady) {
            assert("watchdog.2", ti.watches.length > 0);
            let redcheck = false;
            while (ti.watches.length && now > ti.watches[0]) {
                redcheck = true;
                ti.watches.shift();
            }
            if (redcheck) {
                redflagCheck(ti);
            }
        }
    });
}

function redflagCheck(ti, testNow) {
    console.log("SNAP! ", Date(), ti.tab.id, ti.tab.url, ti.state, ti.nchecks, ti.watches);
    return scanTab(ti)
        .then(res => {
            //console.log("SCAN", ti.tab.url, ti.tab.state, res);
            if (res.match) {
                const site = res.match.template.site;
                if (testNow) {
                    return ti.port.postMessage({op: "test_match", site, img:res.corr_img});
                }
                ti.nchecks++;
                ti.state = "redflagged";
                setIcon(ti, "redflagged", {site});
                return ti.port.postMessage({op: "redflag", site, img:res.corr_img});
            } else {
                if (testNow) {
                    return ti.port.postMessage({op: "test_no_match"});
                }
                ti.nchecks++;
                if (ti.state !== "redflagged" && ti.watches.length === 0) {
                    ti.state = "red_done";
                }
                if (["redflagged", "greenflagged", "safe"].indexOf(ti.state) === -1) {
                    setIcon(ti, "checked"); // The page is checked atleast once.
                }
            }
        }).catch(e => console.log("redflagCheck error", e));
}

/*
 * Screenshot a tab and match with all active templates
 */

function scanTab(ti) {
    const tab = ti.tab;
    let screenshot, features, match;

    return snapTab(tab)
        .then(image => normalizeScreenshot(image, tab.width, tab.height, ti.dpr))
        .then(x => screenshot = x)
        .then(screenshot => findOrbFeatures(screenshot))
        .then(x => features = x)
        .then(features => matchTemplates(features))
        .then(x => match = x)
        .then(match => makeCorrespondenceImage(match, screenshot, features))
        .then(corr_img => ({match, corr_img}));

    function snapTab(tab) {
        return new Promise((resolve, reject) => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, resolve);
        });
    }

    function normalizeScreenshot(image, width, height, dpr) {
        const area = {x: 0, y: 0, w: width, h: height};
        return crop(image, area, dpr, false);
    }

    function matchTemplates(scrFeatures) {
        const scrCorners = scrFeatures.corners;
        const scrDescriptors = scrFeatures.descriptors;
        let t0 = performance.now();
        let activeTemplates = Sites.getTemplates();
        for (let i = 0; i < activeTemplates.length; i++) {
            const template = activeTemplates[i];
            const res = matchOrbFeatures(scrCorners, scrDescriptors, template.patternCorners,
                template.patternDescriptors, template.site);
            if (res) {
                let t1 = performance.now();
                console.log("Match found for : " + template.site , " time taken : " + (t1-t0) + "ms", Date());
                res.template = template;
                return Promise.resolve(res);
            }
        }
        return Promise.resolve(null);
    }

    function makeCorrespondenceImage(match, screenshot, features) {
        if (!match) {
            return Promise.resolve(null);
        }
        return findCorrespondence(screenshot, features.corners , match.template, match.matches, match.matchCount,
            match.mask);
    }
}

chrome.tabs.onRemoved.addListener((tabid, removeinfo) => {
    Tabinfo.remove(tabid);
});

chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === "install") {
        chrome.tabs.create({ url: "option.html" });
    }
    if (details.reason === "update") {
        update_flag = true;
    }
});

function checkUpdates() {
    let activeFeeds =  Sites.getFeeds();
    let res = Promise.resolve(true);

    if (activeFeeds.length === 0) {
        res = res.then(x => Sites.updateFeedList(defaultFeeds))
            .then(x => {activeFeeds = Sites.getFeeds(); debug(activeFeeds);});
    }
    res.then(x => {
        let result = activeFeeds.reduce((p, feed) => {
            return p.then(x => updateFeed(feed));
        }, Promise.resolve());
        result.then(x => debug("Resolved "));
    });
}

function updateFeed(feed) {
    debug("Executing ", feed.src);
    let ord = Math.floor(Math.random()*100);
    let src = feed.src + "?ord=" + ord;
    return ajax_get(src)
        .then(data => {
            let res = Promise.resolve(true);
            debug("Versions feed, data : ", feed.version, data.version);
            if (feed.version !== data.version) {
                feed.version = data.version;
                feed.last_updated = new Date().toUTCString();
                res = res.then( x => Sites.updateDefaultSites(data.sites))
                    .then(x => Sites.updateFeedList(feed));
            }
            //return res;
            return res.then(x => {
                debug("Updated ", feed.src);
            });
        })
        .catch(err => {
            debug("Error for feed : ", feed.src, "  Error Msg : ", err);
        });
}

/********* Functions for Option Page *************/

function getProtectedSitesData() {
    let data = Sites.getSites("exists").filter(x => {
        let protected = x.protected ? x.protected.filter(p => !p.deleted):[];
        let templates = x.templates ? x.templates.filter(t => !t.deleted):[];
        if (protected.length > 0 || templates.length > 0) {
            return true;
        }
        return false;
    }).map( site => {
        if (site.templates) {
            site.templates.filter(a => !a.deleted && !a.disabled).map(template => {
                let found = _.find(Sites.getTemplates(), x => x.checksum === template.checksum);
                if (found) {
                    template.base64 = found.base64;
                } else {
                    template.deleted = true;
                }
                return template;
            });
        }
        return site;
    });
    return data;
}

function getSafeDomainsData() {

    function flatten(sites) {
        return sites.filter(y => !y.deleted && !y.disabled && y.safe && y.safe.length)
            .map(x => x.safe)
            .reduce((a,b) => _.cloneDeep(a).concat(_.cloneDeep(b)),[]);
    }
    let cdata = flatten(Sites.customSites),
        ddata = flatten(Sites.defaultSites).map(s => (s.protected = true, s));

    return cdata.concat(ddata);
}

/*******************/
function errorfn(err) {
    console.log("Inedexeddb error occured : ", err);
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
    setDefaultSecurityImage();
    return Sites.init()
        .then(x => checkUpdates());
}

function cleanDB(respond) {
    return Sites.reset()
        .then(x => chrome.storage.local.remove("secure_img"))
        .then(x => respond())
        .catch(e => console.log("cleanDB error", e));
}

function backupDB(responsd) {
    return Sites.backup()
}

function restoreBackup(data, respond) {
    return Sites.backupResotre(data)
    .then(x =>  respond())
    .catch(x => respond({message: x.message}));
}

function initAdvConfigs() {
    chrome.storage.local.get("adv_config", function(result) {
        var data = result.adv_config;
        debug("Data received : ", data);
        if (data) {
            DEBUG = data.debug? true : false;
            basic_mode = data.basic_mode ? true : false;
        } else {
            DEBUG = true;
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

function setIcon(ti, state, info) {
    const iconFolder = "assets/icons";
    let tabId = ti.tab.id,
        path = iconFolder + "/icon24.png",
        title = "Page not tested",
        text = "", times = "";

    switch (state) {
    case "safe":
        title = "Page belongs to safe domain";
        path = iconFolder + "/icon24-green.png";
        break;
    case "greenflagged":
        title = "Protected page verified: " + info.site;
        path = iconFolder + "/icon24-green.png";
        break;
    case "redflagged":
        text = ti.nchecks.toString();
        title = "Possible phishing: looks like " + info.site;
        path = iconFolder + "/icon24-red.png";
        break;
    case "red_done":
    case "checked":
        text = ti.nchecks.toString();
        times = (ti.nchecks === 1) ? "time" : "times";
        title = `Page tested ${text} ${times}, looks clean`;
        path = iconFolder + "/icon24-blue.png";
        break;
    }

    ti.status = title;
    chrome.browserAction.setIcon({path, tabId});
    chrome.browserAction.setTitle({title, tabId});
    chrome.browserAction.setBadgeText({text, tabId});
}

function addToProtectedList(tab, logo) {
    const url = tab.url;

    return Sites.addProtectedURL(url, logo)
        .then(x => Sites.getProtectedURL(url))
        .then(u => {
            const ti = Tabinfo.get(tab.id);
            ti.state = "greenflagged";
            setIcon(ti, "greenflagged", {site: u.site});
            ti.checkState = false;
        });
}

function removeFromProtectedList(tab) {
    const url = tab.url;

    return Sites.removeProtectedURL(url)
        .then(x => {
            const ti = Tabinfo.get(tab.id);
            ti.state = "red_done";
            setIcon(ti, "red_done");
            ti.checkState = false;
        });
}

function removeSite(name, respond) {
    return Sites.removeSite(name)
        .then(x => respond({}))
        .catch(x => respond({error: x.message}));
}

function toggleSite(name, enable, respond) {
    return Sites.toggleSite(name, enable)
        .then(x => respond({}))
        .catch(x => respond({error: x.message}));
}

function removeURL(url, respond) {
    return Sites.removeProtectedURL(url)
        .then(x => respond({}))
        .catch(x => respond({error: x.message}));
}

function toggleURL(url, enable, respond) {
    return Sites.toggleURL(url, enable)
        .then(x => respond({}))
        .catch(x => respond({error: x.message}));
}

function removeSafeDomain(domain, respond) {
    return Sites.removeSafeDomain(domain)
        .then(x => respond({}))
        .catch(x => respond({error: x.message}));
}

function addSafeDomain(domain, respond) {
    return Sites.addSafeDomain(domain)
        .then(x => respond({}))
        .catch(x => respond({error: x.message}));
}
