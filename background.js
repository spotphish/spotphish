const tabinfo = {};
const watches = [0, 4000];
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
    SPTemplates = [],
    SPDefaultSites = [],
    SPSites = [],
    objWhitelist,
    objFeedList,
    objDefaultSites,
    objCustomSites,
    objTemplateList;

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
            respond({tabinfo: tabinfo[tab.id], debug: DEBUG });
        } else {
            respond({state: "NA"});
        }
    } else if (msg.op === "addToWhitelist") {
        console.log("addToWhitelist handled");
        inject(msg.currentTab, msg.site);
        respond({message: "whitelisted"});
    } else if (msg.op === "removeFromWhitelist") {
        //removeFromWhiteList(msg.site, msg.currentTab);
        removeFromProtectedList(msg.site, msg.currentTab);
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
                    addToProtectedList(sender.tab, cropped, cb);
                    //addToWhiteList(sender.tab, cropped, cb);
                });
            });
        });
    } else if (msg.op === "add_wh") {
        respond({message: "Added"});
        addToProtectedList(sender.tab, null);
        //addToWhiteList(sender.tab, null);
    } else if (msg.op === "add_skip") {
        let domain = getPathInfo(sender.tab.url).host;
        addToKPSkipList(domain);
        respond({message: "added"});
    } else if (msg.op === "urgent_check") {
        respond({action: "nop"});
        let curTabInfo = sender.tab ? tabinfo[sender.tab.id] : tabinfo[msg.curtab.id];
        let tabState = curTabInfo.state;
        if (sender.tab) {
            if (["watching", "init", "red_done"].indexOf(tabState) !== -1) {
                redflag(curTabInfo);
            }
        } else {
            redflag(curTabInfo, true);
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
    //console.log("init", tab.id, tab.url, msg.top ? "top" : "iframe", msg, Date());
    if (msg.top) console.log("init", tab.id, tab.url, msg.top ? "top" : "iframe", msg, Date());

    if (END_STATES.indexOf(ti.state) !== -1) {
        return respond({action: "nop"});
    }

    if (msg.top) {
        ti.dpr = msg.dpr;
        ti.topReady = true;
        ti.inputFields = msg.inputFields;
        //let res = checkWhitelist(tab);
        let res = checkProtectedSite(tab);
        console.log("Result check Protected : ", res);
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

    if (checkSafeDomain(tab.url)) {
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
    //let res = checkWhitelist(tab);
    let res = checkProtectedSite(tab);
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
                redflag(ti);
            }
        }
    });
}

function redflag(ti, testNow = false) {
    console.log("SNAP! ", Date(), ti.tab.id, ti.tab.url, ti.state, ti.nchecks, ti.watches);
    snapcheck(ti, testNow);
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


function snapcheck(ti, testNow) {
    const tab = ti.tab;
    chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, image => {
        // image is base64

        var scrCorners = [];
        var scrDescriptors = [];
        var normalizedImage;
        const area = {x: 0, y: 0, w: tab.width, h: tab.height};
        crop(image, area, ti.dpr, false, cropped => {
            normalizedImage = cropped;
            ti.nchecks++;
            findOrbFeatures(normalizedImage).then(result => {
                scrCorners = result.corners;
                scrDescriptors = result.descriptors;
                let t0 = performance.now();
                //for (let i = 0; i < KPTemplates.length; i++) {
                //   const template = KPTemplates[i];
                let activeTemplates = SPTemplates.filter(x => !x.disabled);
                for (let i = 0; i < activeTemplates.length; i++) {
                    const template = activeTemplates[i];
                    if (!template.disabled) {
                        const res = matchOrbFeatures(scrCorners, scrDescriptors, template.patternCorners,
                            template.patternDescriptors, template.site);
                        if (res) {
                            let t1 = performance.now();
                            console.log("Match found for : " + template.site , " time taken : " + (t1-t0) + "ms", Date());
                            ti.state = "redflagged";
                            setIcon(ti, "redflagged", {site: template.site});
                            findCorrespondence(normalizedImage, scrCorners , template, res.matches, res.matchCount,
                                res.mask, img => ti.port.postMessage({op: "redflag", site: template.site, img:img}));
                            matchFound = true;
                            break;
                        }
                    }
                }

                if (!matchFound && testNow) {
                    ti.port.postMessage({op: "no_match"});
                }

                if (ti.state !== "redflagged" && ti.watches.length === 0) {
                    ti.state = "red_done";
                }
                if (["redflagged", "greenflagged", "safe"].indexOf(ti.state) === -1) {
                    console.log("setting icon to checked", ti.nchecks);
                    setIcon(ti, "checked"); // The page is checked atleast once.
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
                    return u.url === ind.url;
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
}

function syncTemplateList() {
    objTemplateList.getAll((data) => {
        if (data.length > 0) {
            SPTemplates = data.filter(x => !x.disabled);
        }
    });
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
    ajax_get(src, (err, data) => {
        if (!err && data) {
            console.log("Versions feed, data : ", feed.version, data.version);
            if (feed.version !== data.version) {
                feed.version = data.version;
                feed.last_updated = new Date().toUTCString();
                objFeedList.put(feed);
                updateDefaultSitesFromFeedData(data);
                //TODO: Update the default_sites table and template_list.
            }
        } else {
            console.log("Error for feed : ", feed.src, "  Error Msg : ", err);
        }
    });
}

function updateDefaultSitesFromFeedData(feed_data) {
    let sites = feed_data.sites;
    objDefaultSites.putBatch(sites, syncSPSites, errorfn);
}


function mergeSite(update, old) {
    const unionProperty = {
        templates : "checksum",
        safe: "domain",
        protected: "url"
    };
    let new_data = Object.assign({}, update); // We don't want to make any changes in update object. 
    if (update.deleted) {
        return update;
    }
    let result = Object.assign({},update);
    for (const key in old) {
        if (unionProperty[key]) {
            if (!new_data[key]) {
                result[key] = old[key];
            } else {
                //result[key] = _.unionBy(new_data[key], old[key], unionProperty[key]);
                result[key] = _.values(_.merge(
                    _.keyBy(old[key], unionProperty[key]),
                    _.keyBy(new_data[key], unionProperty[key])
                ));
                console.log("Key : ", key, " result[key] : ", result[key]);
            }
        } else {
            if (!new_data[key]) {
                result[key] = old[key];
            }
        }
    }
    return result;
}
/*
const t1 = [{checksum: 1111, deleted: true}, {checksum: 2222}, {checksum: 3333, deleted: true}],
      t2 = [{checksum: 1111, disabled: true}, {checksum: 3333, deleted: false, disabled: true}, {checksum: 4444}];
console.log("T1 : ", t1);
console.log("T2 : ", t2);
let t3 = _.values(_.merge(
            _.keyBy(t1, 'checksum'),
            _.keyBy(t2, 'checksum')
        ));
console.log("T3 : ", t3);
*/
function syncSPSites() {
    objDefaultSites.getAll(default_data => {
        let tmp = default_data;
        console.log("Default Sites : ", tmp);
        let sites = default_data;
        objCustomSites.getAll(custom_data => {
            console.log("Custom Sites : ", custom_data);
            custom_data.forEach(x => {
                let found = default_data.findIndex(y => y.name === x.name);
                if (found === -1) {
                    //Entry only on custom_sites.
                    sites.push(x);
                } else {
                    // Index of the site in sites should be same as the index of the site in default_site
                    let merged_site = mergeSite(x,default_data[found]);
                    sites[found] = merged_site;
                }
            });
            SPSites = sites;
            console.log("SPSites : ", SPSites);
            updateTemplateList();
        });
    });
}

function updateTemplateList() {
    let templates = SPSites.filter(x => !x.deleted && x.templates).map(y => {
        return y.templates.map(z=> {
            z.site = y.name;
            return z;
        });
    }).reduce((a,b) => a.concat(b),[]);
    let checksumList = templates.filter(x => !x.deleted).map(y => y.checksum);
    let garbageTemplates = SPTemplates.filter(x => {
        return checksumList.indexOf(x.checksum) === -1;
    }).map(y => y.checksum);
    console.log("Garbage Templates : ", garbageTemplates);
    objTemplateList.removeBatch(garbageTemplates, syncTemplateList, errorfn); //Cleanup Garbage templates.
    let newTemplates = templates.filter(x => {
        return !x.deleted && SPTemplates.findIndex(y => x.checksum === y.checksum) === -1;
    });
    console.log("New Templates : ", newTemplates);
    newTemplates.forEach(x => {
        if (x.image) {
            createPatterns(x.image).then(function(result) {
                console.log("Template promise result : ", result);
                x.base64 = result.base64;
                x.patternCorners = result.patternCorners;
                x.patternDescriptors = result.patternDescriptors;
                objTemplateList.put(x);
                SPTemplates.push(x);
            }).catch((e) => {
                console.log(e);//promise rejected.
                return;
            });
        }
    });
}

function getSiteFromUrl(url) {
    let host = getPathInfo(url).host;
    let found = SPSites.filter(a => !a.deleted).filter(x => {
        let domain = x.safe.filter(y => host.endsWith(y.domain));
        if (domain.length > 0) {
            return true;
        }
        return false;
    });
    if (found.length > 0) {
        return found[0];
    }
    return null;
}

function checkProtectedSite(tab) {
    let url1 = stripQueryParams(tab.url);
    let site = getSiteFromUrl(tab.url);
    if (site && !site.disabled && site.protected) {
        let found = site.protected.filter(x =>  !x.deleted && !x.disabled && x.url === url1 );
        if (found.length > 0) {
            found[0].site = site.name;
            return found[0];
        }
    }
    return null;
}

function addToProtectedList(tab, logo, cb) {
    let url = stripQueryParams(tab.url),
        site = getSiteFromUrl(url),
        pattern = {}, data = {};
    if (!site) {
        data.name = getPathInfo(url).host;
        data.src = "user_defined";
        data.safe = [{domain: data.name}];
    } else {
        data.name = site.name;
        data.src = site.src;
        if (site.disabled) {
            data.disabled = false; // If the site is disabled enable it and add the url in protected list
        }
    }
    data.protected = [{url: url, disabled: false}];
    //TODO: If any template is  already assosciated with this url and marked as disabled
    //We are not doing anything to that. We need to think a workflow for that.

    if (logo) {
        createPatterns(logo).then(function(result) {
            console.log("Template promise result : ", result);
            pattern.base64 = logo;
            pattern.patternCorners = result.patternCorners;
            pattern.patternDescriptors = result.patternDescriptors;
            pattern.site = data.name;
            pattern.checksum = CryptoJS.SHA256(logo).toString();
            pattern.page = url;
            objTemplateList.put(pattern, syncTemplateList, errorfn);
            data.templates = [{page: url, checksum: pattern.checksum}];
            console.log("SHA256 : ", pattern.checksum);
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
    }

    objCustomSites.get(data.name, (x) => {
        if (x) {
            let res = mergeSite(data, x);
            console.log("Result : ", res);
            objCustomSites.put(res, syncSPSites);
        } else {
            objCustomSites.put(data, syncSPSites);
        }
    });
}

function removeFromProtectedList(url, tab) {
    let site = getSiteFromUrl(url);
    let indexProtected = site.protected.findIndex(x => x.url === url),
        indexTemplate = -1;
    if (indexProtected === -1) {
        console.log("This is not in protected sites list");
        return;
    }
    if (site.templates) {
        indexTemplate = site.templates.findIndex(x => x.page && x.page === url);
    }
    if (site.src === "user_defined") {
        if (indexTemplate !== -1) {
            site.templates.splice(indexTemplate, 1);
        }
        site.protected.splice(indexProtected, 1);
        objCustomSites.put(site, syncSPSites);

    } else { // This is one of the default sites.
        objCustomSites.get(site.name, (curSite) => {
            let newSite = {};
            newSite.name = site.name;
            newSite.src = site.src;
            let protected_entry = site.protected[indexProtected];
            protected_entry.deleted = true;
            newSite.protected = [protected_entry];
            if (indexTemplate !== -1) {
                let template_entry = site.templates[indexTemplate];
                template_entry.deleted = true;
                newSite.templates = [template_entry];
            }
            if (curSite) {
                newSite = mergeSite(newSite, curSite);
            }
            objCustomSites.put(newSite, syncSPSites);
        });
    }
    if (tab) {
        tabinfo[tab.id].state = "red_done";
        setIcon(tabinfo[tab.id], "red_done");
        tabinfo[tab.id].checkState = false;
    }
}

function toggleProtectedUrl(url, enable) {
    let site = getSiteFromUrl(url);
    // We are not putting any validation here. We are sure the "url" will definitely hit one of the sites.
    let protected = site.protected.filter(x => !x.deleted && x.url === url),
        templates = [];
    if (protected.length === 0) {
        //Control will never reach here.
        console.log("This is not in protected sites list");
        return;
    }
    protected[0].disabled = !enable;
    if (site.templates) {
        templates = site.templates.filter(x => x.page && x.page === url);
    }

    let data = {};
    data.name = site.name;
    data.src = site.src;
    if (templates.length > 0) {
        data.templates = templates.map(x => {
            x.disabled = !enable;
            return x;
        });
    }
    objCustomSites.get(site.name, (curSite) => {
        if (curSite) {
            data = mergeSite(data, curSite);
        }
        objCustomSites.put(data, syncSPSites);
    });
}

function checkSafeDomain(url) {
    let site = getSiteFromUrl(url);
    let host = getPathInfo(url).host;
    if (site) {
        let domain = site.safe.filter(x => !x.deleted && !x.disabled && host.endsWith(x.domain));
        if (domain.length > 0) {
            return true;
        }
    }
    return false;
}

function removeSiteByName(name) {
    let site = SPSites.filter(x => x.name === name);
    if (site.length > 0) {
        site = site[0];
        if (site.src !== "user_defined") {
            objCustomSites.put({ name: name, src: site.src, deleted: true}, syncSPSites);
        } else {
            objCustomSites.remove(name, syncSPSites);
        }
    } else {
        console.log(name, "is not in DB ");
    }
}

function toggleSite(name, enable) {
    //TODO: We are not doing anything with safelist here
    let site = SPSites.filter(x => !x.deleted && x.name === name);
    let disable = !enable;
    if (site.length > 0) {
        site = site[0];
        let data = {};
        data.name = site.name;
        data.src = site.src;
        data.disabled = disable;
        if (site.templates) {
            data.templates = site.templates.map(x => {
                x.disabled = disable;
                return x;
            });
        }
        if (site.protected) {
            data.protected = site.protected.map(x => {
                x.disabled = disable;
                return x;
            });
        }
        objCustomSites.put(data, syncSPSites, errorfn);
    } else {
        console.log(name, "is not in DB ");
    }

}

function addToSafeDomains(domain) {
    let site = null;
    let found = SPSites.filter(a => !a.deleted).filter(x => {
        let res = x.safe.filter(y => domain.endsWith(y.domain));
        if (res.length > 0) {
            return true;
        }
        return false;
    });
    if (found.length > 0) {
        site = found[0];
    }
    if (!site) {
        let data = {};
        data.name = domain;
        data.safe = [{domain: data.name}];
        data.src = "user_defined";
        objCustomSites.put(data);
        SPSites.push(data);
    } else {
        let safe = site.safe.filter(x => domain.endsWith(x.domain));
        if (safe[0].deleted ) {
            // Make deleted = false and push to the objCustomSite
            objCustomSites.get(site.name, curSite => {
                let res = {};
                res.name = site.name;
                res.src = site.src;
                let tmp = safe[0];
                tmp.deleted = false;
                res.safe = [tmp];
                if (curSite) {
                    res = mergeSite(res, curSite);
                }
                objCustomSites.put(res, syncSPSites);
            });
        } else {
            console.log("Already in safe list : ", safe[0].domain);
            return "Already in safe list : " +  safe[0].domain;
        }
    }
}

function removeFromSafeDomainsByURL(url) {
    let site = getSiteFromUrl(url);
    if (!site) {
        console.log("This url does not belong to safe domains");
    }

    if (site.src === "user_defined") {
        if (!site.protected && !site.templates && site.safe.length === 1) { // It means site has only safe list entry
            objCustomSites.remove(site.name, syncSPSites);
        }
        //TODO:
        //In future we may allow the user to add multiple safe domains for a site,
        //so we need to handle that. Secondly we should not allow the user to delete
        //an entry if any of its page in protected list.(In ideal case we won't get
        //this option, as we disable delete option of safe domains for the sites
        //which has protected lists)
    } else {
        let data = {},
            host = getPathInfo(url).host;
        data.name = site.name;
        let safe_entry = site.safe.filter(x => x.domain === host);
        safe_entry[0].deleted = true;
        data.safe = safe_entry;
        data.src = site.src;
        objCustomSites.get(site.name, curSite => {
            let res;
            if (curSite) {
                res = mergeSite(data, curSite);
            } else {
                res = data;
            }
            objCustomSites.put(res, syncSPSites);
        });
    }
}

function removeFromSafeDomainsBySiteName(name) {
    let sites = SPSites.filter(x => x.name === name);
    let site;
    if ( sites.length > 0) {
        site = sites[0];
    } else {
        console.log("Site ", name, " is not in the list");
        return;
    }

    if (site.src === "user_defined") {
        if (!site.protected && !site.templates) { // It means site has only safe list entry
            objCustomSites.remove(site.name, syncSPSites);
        }
    } else {
        let data = {};
        data.name = site.name;
        let safe_entry = site.safe.map(x => {
            x.deleted = true;
            return x;
        });
        data.safe = safe_entry;
        data.src = site.src;
        objCustomSites.get(site.name, curSite => {
            let res;
            if (curSite) {
                res = mergeSite(data, curSite);
            } else {
                res = data;
            }
            objCustomSites.put(res, syncSPSites);
        });
    }
}


/********* Functions for Option Page *************/

function getProtectedSitesData() {
    let data = SPSites.filter(x => !x.deleted && (x.protected || x.templates)).map( site => {
        let res = site;
        if (res.templates) {
            res.templates.map(template => {
                template.base64 = SPTemplates.filter(y => y.checksum === template.checksum)[0].base64;
                return template;
            });
        }
        return res;
    });
    console.log("Protected Data : ", data);
    return data;
}

function getSafeDomainsData() {
    let data = SPSites.filter(x => !x.deleted).filter(y => {
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
    var onSuccess = function(data) {
        console.log("Data : ", data);
        data.domains.forEach(x => removeFromKPSkipList(x));
        objWhitelist.remove(id, syncWhiteList);
    };
    var onError = function(error) {
        console.log("Error updating field : ", error);
        return;
    };
    objWhitelist.get(id, onSuccess, onError);
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
        setIcon(tabinfo[tab.id], "greenflagged", {site: site});
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
            setIcon(tabinfo[tab.id], "greenflagged", {site: site});
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
            removeFromWhiteListById(found[0].id);
            debug("Removed from whitelist : ", site);
        }
        tabinfo[tab.id].state = "red_done";
        setIcon(tabinfo[tab.id], "red_done");
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

    function initDefaultSites () {
        return new Promise((resolve) => {
            objDefaultSites = new IDBStore({
                storeName: "default_sites",
                keyPath: "name",
                onStoreReady: () => {resolve("default_site");},
                onError: errorfn,
                indexes: [
                    { name: "name", keyPath: "name", unique: false, multiEntry: false }
                ]
            });
        });
    }
    function initCustomSites () {
        return new Promise((resolve) => {
            objCustomSites = new IDBStore({
                storeName: "custom_sites",
                keyPath: "name",
                onStoreReady: () => {resolve("custom_site");},
                onError: errorfn,
                indexes: [
                    { name: "name", keyPath: "name", unique: false, multiEntry: false }
                ]
            });
        });
    }

    function initTemplates() {
        return new Promise((resolve) => {
            objTemplateList = new IDBStore({
                storeName: "template_list",
                keyPath: "checksum",
                unique: true,
                onStoreReady: () => {
                    objTemplateList.getAll((data) => {
                        if (data.length > 0) {
                            SPTemplates = data;
                        }
                        resolve("template_list");
                    });
                },
                onError: errorfn,
                indexes: [
                    { name: "name", keyPath: "name", unique: false, multiEntry: true }
                ]
            });
        });
    }

    Promise.all([initTemplates(), initDefaultSites(), initCustomSites()]).then( result => {
        syncSPSites();
        objFeedList = new IDBStore({
            storeName: "feed_list",
            keyPath: "src",
            unique: true,
            onStoreReady: initFeedList,
            onError: errorfn,
            indexes: [
                { name: "name", keyPath: "name", unique: false, multiEntry: true }
            ]
        });

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
