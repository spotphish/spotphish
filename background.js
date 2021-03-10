/*
 * Copyright (C) 2017 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file LICENSE for license details.
 */
var GPU_BUSY = false;
const watches = [0, 4000];
const WATCHDOG_INTERVAL = 1000; /* How often to run the redflag watchdog */
const STATES = ["init", "watching", "safe", "greenflagged", "redflagged", "red_done"];
const END_STATES = ["safe", "greenflagged", "redflagged", "red_done"];
const DEFAULT_IMG = chrome.extension.getURL("assets/img/secure_img/kp3.jpg");
const UPDATE_CHECK_INTERVAL = 10 * 60 * 60 * 1000; // 10 hours
var MODEL_UPDATE_TIME = +new Date()

var update_flag = false;
var restore_msg = false;
let DEBUG = false,
    SECURE_IMAGE = true,
    SECURE_IMAGE_DURATION = 1,
    AVAILABLE_MODELS = [],
    globalCurrentTabId,
    tabInfoList = {};
var ROOT_DIR;
let REVISIT_DURATION = 10 * 60 * 1000,
    EXEMPT_CHECKS = false,
    SECURE_IMAGE_SHOWN = false,
    CHECKS_RESULT;
var CONVERTER = undefined;
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
Tabinfo.get = function (id) {
    return Tabinfo.instances[id];
};

Tabinfo.remove = function (id) {
    delete Tabinfo.instances[id];
};

/* Dump state for debugging */
Tabinfo.show = function () {
    for (const x in Tabinfo.instances) {
        const ti = Tabinfo.get(x);
        console.log("TAB", ti.tab.id, ti.tab.url, ti.state);
    }
};

async function loadPreconfiguredModels() {
    for (let item of defaultModels) {
        ROOT_DIR = undefined
        let x = _.cloneDeep(item);
        x.name = (x.label).replace(/\s+/g, "_");
        let srcFile = x.root;
        srcFile = srcFile.replace("github.com", "cdn.jsdelivr.net/gh")
        srcFile = srcFile.replace("tree/", "")
        let splitted_domain = srcFile.split("/")
        splitted_domain.splice(6, 1)
        let latest_version = await loadLatestVersion(splitted_domain[4], splitted_domain[5])
        if (latest_version.name !== undefined) {
            splitted_domain[5] = splitted_domain[5] + "@" + latest_version.name;
        }
        ROOT_DIR = splitted_domain.slice(0, 6).join("/")
        srcFile = splitted_domain.join("/");
        srcFile += "/Model.js"
        if (!srcFile.includes("https://cdn.jsdelivr.net/")) {
            continue;
        }

        let remoteFile;
        try {
            remoteFile = (await import(srcFile));
        } catch (e) {
            console.log(e);
            continue
        }
        let Model = remoteFile.default;
        if (Model !== undefined) {
            if (Model.prototype.predict != null && (typeof Model.prototype.predict) === "function") {
                if (Model.dependencies !== undefined && Array.isArray(Model.dependencies)) {
                    x.dependencies = Model.dependencies;
                } else {
                    x.dependencies = [];
                }
            } else {
                continue
            }
        } else {
            continue
        }
        x.src = srcFile;
        x.root = ROOT_DIR
        fetch(splitted_domain.join("/") + "/brands.json").then(response => response.json())
            .then(data => {
                x.brands = data
            });

        ROOT_DIR = undefined

        setAvailableModels(x);
    }
    console.log(AVAILABLE_MODELS);
}
setInterval(checkUpdates, UPDATE_CHECK_INTERVAL);
setInterval(() => {
    modelsUpdateCheck().then(() => {
        MODEL_UPDATE_TIME = +new Date();
        saveAdvConfig()
    });
    fetchBrandToDomainConverter()
}, UPDATE_CHECK_INTERVAL)

async function modelsUpdateCheck() {
    for (let item of getAvailableModels()) {
        let splitted_domain = item.src.split("/")
        let user = splitted_domain[4]
        let repo = splitted_domain[5].split("@")[0];
        let currentVersion = splitted_domain[5].split("@")[1]
        let newVersion = await loadLatestVersion(user, repo);
        console.log(item.name + " " + currentVersion + "-->" + newVersion.name)
        if (currentVersion === newVersion.name) {
            continue;
        }
        if (newVersion.name !== undefined) {
            splitted_domain[5] = repo + "@" + newVersion.name
        } else {
            splitted_domain[5] = repo;
        }
        ROOT_DIR = undefined
        ROOT_DIR = splitted_domain.slice(0, 6).join("/")
        let srcFile = splitted_domain.join("/");

        if (!srcFile.includes("https://cdn.jsdelivr.net/")) {
            continue;
        }

        let remoteFile;
        try {
            remoteFile = (await import(srcFile));
        } catch (e) {
            console.log(e);
            continue
        }
        let Model = remoteFile.default;
        if (Model !== undefined) {
            if (Model.prototype.predict != null && (typeof Model.prototype.predict) === "function") {
                if (Model.dependencies !== undefined && Array.isArray(Model.dependencies)) {
                    item.dependencies = Model.dependencies;
                } else {
                    item.dependencies = [];
                }
            } else {
                continue
            }
        } else {
            continue
        }
        item.src = srcFile;
        item.root = ROOT_DIR
        fetch(splitted_domain.join("/") + "/brands.json").then(response => response.json())
            .then(data => {
                item.brands = data
            });
        ROOT_DIR = undefined
        unInjectScripts(item.name)
        injectScripts(item)
        saveAdvConfig()
    }
}


async function loadLatestVersion(USER, PROJECT) {
    let response = await fetch("https://api.github.com/repos/" + USER + "/" + PROJECT + "/releases/latest");
    let data = await response.json();
    return data;
}

function getUpdateFlag() {
    return update_flag;
}
chrome.runtime.onConnect.addListener(port => {
    const ti = new Tabinfo(port.sender.tab.id, port.sender.tab, port);
    setIcon(ti, "init");

});

function unInstallPlugin() {

    chrome.tabs.create({
        url: "chrome://extensions/"
    });
    chrome.management.uninstallSelf();
}

setInterval(watchdog, WATCHDOG_INTERVAL);

function unInjectScripts(item) {
    $("#" + item).remove();

}

function injectScripts(item) {
    if ($("#" + item.name).length !== 0) {
        return;
    }
    let di = document.createElement('div');
    di.id = item.name;
    document.body.appendChild(di);
    for (let x of item.dependencies) {
        let ga1 = document.createElement('script');
        ga1.type = 'text/javascript';
        ga1.src = x;
        $("#" + item.name).append(ga1);
    }

}
chrome.runtime.onMessage.addListener(async function (msg, sender, respond) {

    if (sender.tab) {
        const ti = Tabinfo.get(sender.tab.id);
        if (ti) {
            ti.update(sender.tab);
        }
    }

    if (msg.op === "init") {
        init(msg, sender).then(x => respond(x)).catch(x => console.log(x));

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
            respond({
                state: "NA"
            });
        }
    } else if (msg.op === "protect_page") {
        inject(msg.tab);
        respond({
            message: "whitelisted"
        });
    } else if (msg.op === "unprotect_page") {
        removeFromProtectedList(msg.tab)
            .then(x => respond({
                message: "removed"
            }))
            .catch(x => respond({
                message: "failed",
                err: x.message
            }));
    } else if (msg.op === "crop_capture") {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, tab => {
            chrome.tabs.captureVisibleTab(tab.windowId, {
                format: "png"
            }, image => {
                let cropped;
                crop(image, msg.area, msg.dpr, true)
                    .then(x => cropped = x)
                    .then(cropped => addToProtectedList(sender.tab, cropped))
                    .then(x => respond({
                        message: "cropped",
                        image: cropped
                    }))
                    .catch(x => respond({
                        message: "failed",
                        err: "few_corners"
                    }));
            });
        });
    } else if (msg.op === "protect_basic") {
        addToProtectedList(sender.tab, null)
            .then(x => respond({
                message: "Added"
            }))
            .catch(x => respond({
                message: "failed",
                err: x.message
            }));
    } else if (msg.op === "urgent_check") {
        respond({
            action: "nop"
        });
        let ti = Tabinfo.get(sender.tab.id);
        let tabState = ti.state;
        // if (["watching", "init", "red_done"].indexOf(tabState) !== -1) {
        //     redflagCheck(ti);
        // }
        blockPassword(ti);

    } else if (msg.op === "test_now") {
        const ti = Tabinfo.get(msg.tab.id);
        redflagCheck(ti, true);
    } else {
        console.log("KPBG: Unknown message", msg);
    }
    return true;
});

function inject(tab) {
    let ti = Tabinfo.get(tab.id);
    let found = Sites.getProtectedURL(tab.url);
    if (!found) {
        ti.port.postMessage({
            op: "crop_template",
            data: {}
        });
    } else {
        console.log("Already protected: ", tab.url);
    }
}


function blockPassword(ti) {
    if (CHECKS_RESULT != undefined && (!SECURE_IMAGE_SHOWN || (SECURE_IMAGE_SHOWN && CHECKS_RESULT.op === "redflag"))) {
        ti.port.postMessage(CHECKS_RESULT)
        SECURE_IMAGE_SHOWN = true
    }
    CHECKS_RESULT = undefined
}

async function init(msg, sender) {
    return new Promise((res, rej) => {
        CHECKS_RESULT = undefined
        const ti = Tabinfo.get(sender.tab.id);
        if (ti == undefined) {
            res({
                action: "nop"
            });
        }
        const tab = ti.tab;
        //console.log("init", tab.id, tab.url, msg.top ? "top" : "iframe", msg, Date());
        // if (msg.top) console.log("init", tab.id, tab.url, msg.top ? "top" : "iframe", msg, Date());

        if (END_STATES.indexOf(ti.state) !== -1) {
            res({
                action: "nop"
            });
        }

        res({
            action: "check"
        });
        if (msg.top) {

            ti.dpr = msg.dpr;
            ti.topReady = true;
            ti.inputFields = msg.inputFields;
            let currentDomain = tab.url.split("/")[2];

            let currentTime = +new Date();
            let lastDomain, lastTime, lastState;
            chrome.storage.local.get("" + tab.id + "", async function (result) {
                result = result["" + tab.id + ""];
                if (!_.isEmpty(result)) {
                    lastDomain = result.last_domain;
                    lastTime = result.last_time;
                    lastState = result.last_state;
                }
                if (currentDomain != lastDomain || currentTime - lastTime >= REVISIT_DURATION) {
                    //domain change
                    let isInSafeDomains = Sites.getSafeDomain(currentDomain) != undefined ? true : false;
                    if (EXEMPT_CHECKS && isInSafeDomains) {
                        // ti.state = "safe"
                        setIcon(ti, "safe");
                        ti.port.postMessage({
                            op: "greenflag",
                            site: currentDomain,
                            type: 1
                        });
                        SECURE_IMAGE_SHOWN = true;
                        console.log("safe domain");

                    } else {
                        let screenshot = await snapTab(tab)
                            .then(image => normalizeScreenshot(image, tab.width, tab.height, ti.dpr));
                        let result;
                        try {
                            let startTime = performance.now();
                            result = await predict(screenshot, AVAILABLE_MODELS);
                            GPU_BUSY = false;

                            console.log(performance.now() - startTime)
                            console.log(result);
                        } catch (err) {
                            alert(err);
                            GPU_BUSY = false;
                            result = undefined;
                        }
                        if (result !== undefined && result.site !== "NaN") {
                            //predicted
                            SECURE_IMAGE_SHOWN = true;
                            let site = result.site
                            site += " with "
                            site += categorize(result.confidence)
                            if (equalStrings(currentDomain, result.site)) {

                                ti.state = "greenflagged";
                                setIcon(ti, "greenflagged", {
                                    site: currentDomain
                                });
                                ti.port.postMessage({
                                    op: "greenflag",
                                    site: currentDomain,
                                    type: 2
                                });
                                console.log("predicted safe");
                            } else {
                                ti.state = "redflagged";
                                setIcon(ti, "redflagged", {
                                    site: result.site
                                });
                                ti.port.postMessage({
                                    op: "redflag",
                                    site: site,
                                    img: result.image
                                })
                                console.log("predicted unsafe");
                            }

                        } else {
                            //not predicted
                            if (isInSafeDomains) {
                                // ti.state = "safe"

                                setIcon(ti, "safe");
                                ti.port.postMessage({
                                    op: "greenflag",
                                    site: currentDomain,
                                    type: 1

                                });
                                SECURE_IMAGE_SHOWN = true;

                                console.log("safe domain");

                            } else {
                                SECURE_IMAGE_SHOWN = false;

                                ti.nchecks++;
                                if (ti.state !== "redflagged" && ti.watches.length === 0) {
                                    ti.state = "red_done";
                                }
                                if (["redflagged", "greenflagged", "safe"].indexOf(ti.state) === -1) {
                                    setIcon(ti, "checked"); // The page is checked atleast once.
                                }
                                console.log("nothing safe");

                            }
                        }

                    }

                    chrome.storage.local.set({
                        [tab.id]: {
                            last_time: currentTime,
                            last_domain: currentDomain,
                            last_state: ti.state
                        },
                    })
                } else {
                    //domain not changed
                    SECURE_IMAGE_SHOWN = false;
                    ti.state = lastState;
                    setIcon(ti, lastState, {
                        site: currentDomain
                    });
                }
            });

        } else {

        }
    })




}

function equalStrings(a, b) {
    a = a.replace(/\s+/g, "").toLowerCase(); //www.onlinesbi.com
    b = b.replace(/\s+/g, "").toLowerCase(); //sbi




    if (CONVERTER != undefined && CONVERTER[b] != undefined && CONVERTER[b].includes(a)) {
        return true;
    }
    return false;

}

function checkdata(msg, sender, respond) {
    respond({
        action: "nop"
    });
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

    respond({
        action: "nop"
    });
    let res = Sites.getProtectedURL(tab.url);
    if (ti.state !== "greenflagged" && res) {
        debug("greenflagging after url change", tab.id, tab.url);
        ti.state = "greenflagged";
        setIcon(ti, "greenflagged", {
            site: res.site
        });
        ti.port.postMessage({
            op: "greenflag",
            site: res.site
        });
    }
}

function watchdog() {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, tabs => {
        if (!tabs.length) return;
        const id = tabs[0].id,
            ti = Tabinfo.get(id) || {};
        const now = Date.now();
        if ((ti.state === "watching") && ti.topReady && !GPU_BUSY) {
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


function categorize(confidence) {
    if (confidence > 75) {
        return " high probability";
    } else if (confidence <= 75 && confidence > 50) {
        return " moderate probability";
    } else if (confidence <= 50 && confidence > 25) {
        return " good probability";
    } else {
        return " fair probability";
    }
}
async function redflagCheck(ti, testNow) {
    console.log("........................Called redflag....................................");
    const tab = ti.tab;
    let screenshot = await snapTab(tab)
        .then(image => normalizeScreenshot(image, tab.width, tab.height, ti.dpr));
    let result;
    try {
        let startTime = performance.now();
        result = await predict(screenshot, AVAILABLE_MODELS);
        GPU_BUSY = false;
        console.log(performance.now() - startTime)
        console.log(result);
    } catch (err) {
        alert(err);
        GPU_BUSY = false;

        result = undefined
    }
    if (result !== undefined && result.site !== "NaN") {
        let site = result.site
        site += " with "
        site += categorize(result.confidence)
        let corr_img = result.image;
        if (testNow) {
            return ti.port.postMessage({
                op: "test_match",
                site,
                img: corr_img
            });
        }
        ti.nchecks++;
        let currentDomain = tab.url.split("/")[2];
        if (equalStrings(currentDomain, result.site)) {

            ti.state = "greenflagged";
            setIcon(ti, "greenflagged", {
                site: currentDomain
            });
            CHECKS_RESULT = {
                op: "greenflag",
                site: currentDomain,
                type: 2
            }

        } else {
            ti.state = "redflagged";
            setIcon(ti, "redflagged", {
                site: result.site
            });
            CHECKS_RESULT = {
                op: "redflag",
                site: site,
                img: corr_img
            }

        }
    } else {
        if (testNow) {
            return ti.port.postMessage({
                op: "test_no_match"
            });
        }
        ti.nchecks++;
        if (ti.state !== "redflagged" && ti.watches.length === 0) {
            ti.state = "red_done";
        }
        if (["redflagged", "greenflagged", "safe"].indexOf(ti.state) === -1) {
            setIcon(ti, "checked"); // The page is checked atleast once.
        }
    }
}

/*
 * Screenshot a tab and match with all active templates
 */

function snapTab(tab) {
    console.log("snapTab");
    return new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(tab.windowId, {
            format: "png",
            quality: 100
        }, (data) => resolve(data));
    });
}


function normalizeScreenshot(image, width, height, dpr) {
    console.log("normalize");

    const area = {
        x: 0,
        y: 0,
        w: width,
        h: height
    };
    return crop(image, area, dpr, false);
}


chrome.tabs.onRemoved.addListener((tabid, removeinfo) => {
    Tabinfo.remove(tabid);
});


function getRestoreMsg() {
    return restore_msg;
}

function setRestoreMsg() {
    restore_msg = false;
}

chrome.runtime.onInstalled.addListener(function (details) {
    function checkReady() {
        setTimeout(() => {
            if (ready) {
                if (details.reason === "install") {
                    restore_msg = true;
                    chrome.tabs.create({
                        url: "option.html"
                    });
                }
                if (details.reason === "update") {
                    update_flag = true;
                    chrome.tabs.create({
                        url: "option.html"
                    })
                }
                return;
            } else {
                checkReady()
            }
        }, 1000)
    }
    checkReady();

});


async function initFeeds() {
    let feeds = Sites.getFeeds("all");

    let res = Promise.resolve(true);

    let val = _.values(_.merge(
        _.keyBy(defaultFeeds, "src"),
        _.keyBy(feeds, "src")
    ));
    return res.then(x => Sites.updateFeedList(val))
        .then(x => checkUpdates());
}

function checkUpdates() {
    let activeFeeds = Sites.getFeeds();
    let res = Promise.resolve(true);
    if (activeFeeds.length === 0) {
        res = res.then(x => Sites.updateFeedList(defaultFeeds))
            .then(x => {
                activeFeeds = Sites.getFeeds();
                debug(activeFeeds);
            });
    }
    res.then(x => {
        let result = activeFeeds.reduce((p, feed) => {
            return p.then(x => updateFeed(feed));
        }, Promise.resolve());
        result.then(x => debug("Resolved"));
    });
}

function updateFeed(feed) {
    debug("Executing ", feed.src);
    let ord = Math.floor(Math.random() * 100);
    let src = feed.src + "?ord=" + ord;
    return ajax_get(src)
        .then(data => {
            let res = Promise.resolve(true);
            debug("Versions feed, data : ", feed.version, data.version);
            if (feed.version !== data.version) {
                feed.version = data.version;
                feed.last_updated = new Date().toUTCString();
                res = res.then(x => Sites.updateDefaultSites(data.sites))
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
        let protected = x.protected ? x.protected.filter(p => !p.deleted) : [];
        let templates = x.templates ? x.templates.filter(t => !t.deleted) : [];
        if (protected.length > 0 || templates.length > 0) {
            return true;
        }
        return false;
    }).map(site => {
        if (site.templates) {
            site.templates = site.templates.filter(a => !a.deleted && !a.disabled)
                .map(template => {
                    // let found = _.find(Sites.getTemplates(), x => x.checksum === template.checksum);

                    // if (found) {
                    //         template.base64 = found.base64;
                    //     } else {
                    //         template.deleted = true;
                    //     }
                    return template;
                });
        }
        return site;
    })
    return data;
}

function getSafeDomainsData() {

    function flatten(sites) {
        return sites.filter(y => !y.deleted && !y.disabled && y.safe && y.safe.length)
            .map(x => x.safe)
            .reduce((a, b) => _.cloneDeep(a).concat(_.cloneDeep(b)), []);
    }
    let cdata = flatten(Sites.customSites),
        ddata = flatten(Sites.defaultSites).map(s => (s.protected = true, s));

    return cdata.concat(ddata);
}

/*******************/
function errorfn(err) {
    console.log("Inedexeddb error occured : ", err);
}

function getSecurityImage(cb) {
    chrome.storage.local.get("secure_img", function (result) {
        cb(result.secure_img);
    });
}

function setSecurityImage(image) {
    chrome.storage.local.set({
        "secure_img": image
    }, function () {});
}

function setDefaultSecurityImage(cb) {
    chrome.storage.local.get("secure_img", function (result) {
        var data = result.secure_img;
        if (typeof data === "undefined") {
            data = {};
            data.type = "default";
            data.src = DEFAULT_IMG;
            chrome.storage.local.set({
                "secure_img": data
            }, cb);
        } else {
            return;
        }
    });
}
loadDefaults()
var ready = false;
async function loadDefaults() {
    await initAdvConfigs();
    setDefaultSecurityImage();
    await Sites.init()
    await initFeeds()
    for (let x of getAvailableModels()) {
        if (x.webgl && x.selected) {
            await primeWebgl(x)
            break;
        }
    }
    if (+new Date() - MODEL_UPDATE_TIME > UPDATE_CHECK_INTERVAL) {
        modelsUpdateCheck().then(() => {
            MODEL_UPDATE_TIME = +new Date();
            saveAdvConfig()
        });
        fetchBrandToDomainConverter()
    }
    ready = true;
}

function cleanDB(respond) {
    return Sites.reset()
        .then(x => chrome.storage.local.remove("secure_img"))
        .then(x => respond())
        .catch(e => console.log("cleanDB error", e));
}

function backupDB(respond) {
    getSecurityImage(function (image) {
        let subscribedFeeds = [];
        Sites.dbFeedList.getAll().then(feedList => {
            feedList.forEach(feed => subscribedFeeds.push(feed));
            let customSites = Sites.backup();
            respond({
                subscribedFeeds: subscribedFeeds,
                sites: customSites,
                secureImage: image,
                debugFlag: getDebugFlag(),
                secureImageFlag: getSecureImageFlag(),
                secureImageDuration: getSecureImageDuration(),
                availableModels: getAvailableModels(),
                exemptChecks: getExemptChecksFlag(),
                converter: getConverter()

            });
        });
    });
}


function restoreBackup(data, respond) {
    return Sites.backupRestore(data.sites)
        .then(x => {
            if (!!data.secureImage) {
                setSecurityImage(data.secureImage);
            }

            if (data.debugFlag !== null) {
                setDebugFlag(data.debugFlag)
            }
            if (data.secureImageFlag !== null) {
                setSecureImageFlag(data.secureImageFlag)
            }
            if (data.exemptChecks !== null) {
                setExemptChecksFlag(data.exemptChecks)
            }
            if (!!data.secureImageDuration) {
                setSecureImageDuration(data.secureImageDuration)
            }
            if (!!data.availableModels) {
                AVAILABLE_MODELS = data.availableModels
                $("body").empty();
                $.each(getAvailableModels(), function (i, item) {
                    injectScripts(item);
                });
            }
            if (!!data.converter) {
                setConverter(data.converter)
            }

        })
        .then(x => respond())
        .catch(x => respond({
            message: x.message
        }));
}
async function primeWebgl(item) {
    console.log("webgl priming...")
    let Model = (await import(item.src)).default;
    ROOT_DIR = item.root
    let x = new Model();
    await x.predict("./assets/img/pixel.png");
    ROOT_DIR = undefined;
}

async function initAdvConfigs() {
    return new Promise((res, rej) => {
        chrome.storage.local.get("adv_config", function (result) {
            var data = result.adv_config;
            debug("Data received : ", data);
            if (data) {
                DEBUG = data.debug ? true : false;
                SECURE_IMAGE = data.show_secure_image ? true : false;
                SECURE_IMAGE_DURATION = data.secure_image_duration ? data.secure_image_duration : 1;
                EXEMPT_CHECKS = data.EXEMPT_CHECKS ? data.EXEMPT_CHECKS : false;
                AVAILABLE_MODELS = data.available_models ? data.available_models : [];
                MODEL_UPDATE_TIME = data.MODEL_UPDATE_TIME ? data.MODEL_UPDATE_TIME : +new Date();
                CONVERTER = data.converter ? data.converter : undefined;
                $.each(getAvailableModels(), function (i, item) {
                    injectScripts(item);
                });
                res()
            } else {
                saveAdvConfig();
                loadPreconfiguredModels().then(() => {
                    res()
                });

            }
            if (CONVERTER === undefined) {
                fetchBrandToDomainConverter()
            }

        });
    })
}

function fetchBrandToDomainConverter() {
    ajax_get(brandToDomainConverter.src)
        .then(data => {
            setConverter(data)

        })
        .catch(err => {
            console.log(err);
        });
}

function saveAdvConfig() {
    chrome.storage.local.set({
        adv_config: {
            debug: DEBUG,
            show_secure_image: SECURE_IMAGE,
            secure_image_duration: SECURE_IMAGE_DURATION,
            EXEMPT_CHECKS: EXEMPT_CHECKS,
            available_models: AVAILABLE_MODELS,
            MODEL_UPDATE_TIME: MODEL_UPDATE_TIME,
            converter: CONVERTER

        }
    });

}

function setDebugFlag(enable) {
    DEBUG = enable;
    saveAdvConfig();
}

function getDebugFlag() {
    return DEBUG;
}

function setExemptChecksFlag(enable) {
    EXEMPT_CHECKS = enable;
    saveAdvConfig();
}

function getExemptChecksFlag() {
    return EXEMPT_CHECKS;
}

function getConverter() {
    return CONVERTER;
}

function setConverter(x) {
    CONVERTER = x;
    saveAdvConfig();
}

function setSecureImageFlag(enable) {
    SECURE_IMAGE = enable;
    saveAdvConfig();
}

function getSecureImageFlag() {
    return SECURE_IMAGE;
}

function setSecureImageDuration(value) {
    SECURE_IMAGE_DURATION = value;
    saveAdvConfig();
}

function getSecureImageDuration() {
    return SECURE_IMAGE_DURATION;
}



function selectModel(model_name) {
    $.each(getAvailableModels(), function (i, item) {
        if (item.name === model_name) {
            item.selected = true;
        }
    });
    saveAdvConfig();
}

function setWeightage(model_name, weight) {
    $.each(getAvailableModels(), function (i, item) {
        if (item.name === model_name) {
            item.weightage = weight;
        }
    });
    saveAdvConfig();


}

function unSelectModel(model_name) {
    $.each(getAvailableModels(), function (i, item) {
        if (item.name === model_name) {
            item.selected = false;

        }
    });
    saveAdvConfig();
}

function setAvailableModels(value) {
    AVAILABLE_MODELS.push(value);
    injectScripts(value);
    saveAdvConfig();
}

async function setFactoryAvailableModels() {
    AVAILABLE_MODELS = []
    $("body").empty()
    await loadPreconfiguredModels()

}

function removeAvailableModels(value) {
    AVAILABLE_MODELS.splice(AVAILABLE_MODELS.findIndex(a => a.name === value), 1)
    unInjectScripts(value);

    saveAdvConfig();
}

function getAvailableModels() {
    return AVAILABLE_MODELS;
}

function setIcon(ti, state, info) {
    const iconFolder = "assets/icons";
    let tabId = ti.tab.id,
        path = iconFolder + "/icon24.png",
        title = "Page not tested",
        text = "",
        times = "";

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
    chrome.browserAction.setIcon({
        path,
        tabId
    });
    chrome.browserAction.setTitle({
        title,
        tabId
    });
    chrome.browserAction.setBadgeText({
        text,
        tabId
    });
}

function addToProtectedList(tab, logo) {
    const url = tab.url;
    return Sites.addProtectedURL(url, logo)
        .then(x => Sites.getProtectedURL(url))
        .then(u => {
            const ti = Tabinfo.get(tab.id);
            ti.state = "greenflagged";
            setIcon(ti, "greenflagged", {
                site: u.site
            });
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
    Sites.removeSite(name)
        .then(x => respond({}))
        .catch(x => respond({
            error: x.message
        }));
}

function toggleSite(name, enable, respond) {
    return Sites.toggleSite(name, enable)
        .then(x => respond({}))
        .catch(x => respond({
            error: x.message
        }));
}

function removeURL(url, respond) {
    return Sites.removeProtectedURL(url)
        .then(x => respond({}))
        .catch(x => respond({
            error: x.message
        }));
}

function toggleURL(url, enable, respond) {
    return Sites.toggleURL(url, enable)
        .then(x => respond({}))
        .catch(x => respond({
            error: x.message
        }));
}

function removeSafeDomain(domain, respond) {
    return Sites.removeSafeDomain(domain)
        .then(x => respond({}))
        .catch(x => respond({
            error: x.message
        }));
}

function addSafeDomain(domain, respond) {
    return Sites.addSafeDomain(domain)
        .then(x => respond({}))
        .catch(x => respond({
            error: x.message
        }));
}