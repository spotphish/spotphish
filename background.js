const tabinfo = {};
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
        port: null,
        nchecks: 0,
        status: ""
    };
    setIcon(tabinfo[id], "init");
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
            respond(tabinfo[tab.id]);
        } else {
            respond({state: "NA"});
        }
    } else if (msg.op === "protect_page") {
        inject(msg.tab);
        respond({message: "whitelisted"});
    } else if (msg.op === "unprotect_page") {
        removeFromProtectedList(msg.tab);
        respond({message: "removed"});
    } else if (msg.op === "crop_capture") {
        chrome.tabs.query({active: true, currentWindow: true}, tab => {
            chrome.tabs.captureVisibleTab(tab.windowId, {format: "png"}, image => {
                crop(image, msg.area, msg.dpr, true)
                .then(cropped => {
                    respond({message: "cropped", image: cropped});
                    return addToProtectedList(sender.tab, cropped);
                }).catch(x => respond({message: "failed", err: "few_corners"}));
            });
        });
    } else if (msg.op === "protect_basic") {
        respond({message: "Added"});
        addToProtectedList(sender.tab, null);
    } else if (msg.op === "urgent_check") {
        respond({action: "nop"});
        let curTabInfo = tabinfo[sender.tab.id];
        let tabState = curTabInfo.state;
        if (["watching", "init", "red_done"].indexOf(tabState) !== -1) {
            redflagCheck(curTabInfo);
        }
    } else if (msg.op === "test_now") {
        const ti = tabinfo[msg.tab.id];
        redflagCheck(ti, true);
    } else {
        console.log("KPBG: Unknown message", msg);
    }
    return true;
});

function inject (tab) {
    let ti = tabinfo[tab.id];
    let found = Sites.getProtectedURL(tab.url);
    if (!found) {
        ti.port.postMessage({op: "crop_template", data: {}});
    } else {
        console.log("Already protected: ", tab.url);
    }
}

function init(msg, sender, respond) {
    const ti = tabinfo[sender.tab.id],
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
    let res = Sites.getProtectedURL(tab.url);
    if (ti.state !== "greenflagged" && res) {
        debug("greenflagging after url change", tab.id, tab.url);
        ti.state = "greenflagged";
        setIcon(ti, "greenflagged", {site: res.site});
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
                redflagCheck(ti);
            }
        }
    });
}

function redflagCheck(ti, testNow) {
    console.log("SNAP! ", Date(), ti.tab.id, ti.tab.url, ti.state, ti.nchecks, ti.watches);
    return scanTab(ti)
        .then(res => {
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

    return snapTab(tab)
        .then(image => normalizeScreenshot(image, tab.width, tab.height, ti.dpr))
        .then(screenshot => findOrbFeatures(screenshot)
            .then(features => matchTemplates(features)
                .then(match => makeCorrespondenceImage(match, screenshot, features)
                    .then(corr_img => ({match, corr_img})))));
                
    function snapTab(tab) {
        return new Promise((resolve, reject) => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, resolve);
        });
    }

    function normalizeScreenshot(image, width, height, dpr) {
        return new Promise((resolve, reject) => {
            const area = {x: 0, y: 0, w: width, h: height};
            crop(image, area, dpr, false, resolve);
        });
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

/*
 * Scheduled for conversion

function initFeedList() {
    objFeedList.getAll((data) => {
        if (data.length <= 0) {
            objFeedList.putBatch(defaultFeeds, checkUpdates);
        } else {
            var newFeeds = defaultFeeds.filter(x => data.map(y => y.src).indexOf(x.src));
            if (newFeeds.length) {
                objFeedList.putBatch(newFeeds, checkUpdates);
            } else {
                checkUpdates();
            }
        }
    });
    setInterval(checkUpdates, UPDATE_CHECK_INTERVAL);
}

function checkUpdates() {
    objFeedList.getAll((data) => {
        var activeFeeds = data.filter(x => !x.deleted && !x.disabled);
        console.log(" Active Feed List : ", activeFeeds);
        activeFeeds.forEach((x) => {
            updateFeed(x);
        });
    });
}

function updateFeed(feed) {
    let ord = Math.floor(Math.random()*100);
    let src = feed.src + "?ord=" + ord;
    $.getJSON(src)
        .done(data => {
            console.log("Versions feed, data : ", feed.version, data.version);
            if (feed.version !== data.version) {
                feed.version = data.version;
                feed.last_updated = new Date().toUTCString();
                objFeedList.put(feed);
                updateDefaultSitesFromFeedData(data);
                //TODO: Update the default_sites table and template_list.
            }
        }).fail(err => {
            console.log("Error for feed : ", feed.src, "  Error Msg : ", err);
            // In case the server is down, our extension should still work with existing data.
            syncSPSites();
        });
}

function updateDefaultSitesFromFeedData(feed_data) {
    let sites = feed_data.sites;
    objDefaultSites.putBatch(sites, syncSPSites, errorfn);
}

*/
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
    let data = Sites.getSites("enabled").filter(y => {
        if (!y.safe) {
            return false;
        }
        let found = y.safe.filter(z => !z.deleted);
        if (found.length > 0) {
            return true;
        }
        return false;
    });
    return data;
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
    return Sites.init();
}

function cleanDB() {
    return Sites.reset()
    .then(x => chrome.storage.local.remove("secure_img"))
    .catch(e => console.log("cleanDB error", e));
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
            tabinfo[tab.id].state = "greenflagged";
            setIcon(tabinfo[tab.id], "greenflagged", {site: u.site});
            tabinfo[tab.id].checkState = false;
        });
}

function removeFromProtectedList(tab) {
    const url = tab.url;

    return Sites.removeProtectedURL(url)
        .then(x => {
            tabinfo[tab.id].state = "red_done";
            setIcon(tabinfo[tab.id], "red_done");
            tabinfo[tab.id].checkState = false;
        });
}
