
var debug = false, 
    globalCurrentTabId,
    tabInfoList = {},
    KPWhiteList,
    KPSkipList,
    KPRedFlagList;


function updateTabInfo(tab, data) {
    var info = {};
    info.domain = data.domain;
    info.url = tab.url;
    if (isSpecialTab(tab.url)) {
        info.status = tab_status.NA;
    } else if (data.pwField) {
        info.status = (data.whitelisted)? tab_status.WHITELISTED : tab_status.NOT_WHITELISTED;
    } else {
        info.status = tab_status.NA;
    }
    tabInfoList[tab.id] = info;
    //console.log("tabinfoList : ", tabInfoList);
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

function init() {
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

var ts0;
chrome.runtime.onMessage.addListener((req, sender, res) => {
    if (req.message === 'capture') {
        chrome.tabs.getSelected(null, (tab) => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (image) => {
                // image is base64

                var matches = [];
                var scrCorners = [];
                var scrDescriptors = [];
                var normalizedImage;
                //TODO:Resolve/reject promise if no match happens
                crop(image, req.area, req.dpr, false, (cropped) => {
                    normalizedImage = cropped;
                    Promise.all([findOrbFeatures(normalizedImage)]).then((results) => {
                        console.log(results);
                        scrCorners = results[0].corners;
                        scrDescriptors = results[0].descriptors;
                        console.log(scrCorners);
                        console.log(scrDescriptors);
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

                       // for (i = 0; i < redFlagSites.length; i++) {
                       //      // console.log(redFlagSites[i], normalizedImage);
                       //      matches[i] = matchTemplate(normalizedImage, redFlagSites[i]);
                       //  }

                        let t0 = performance.now();
                        Promise.race(matches).then((site) => {
                            // console.log("After promise");
                            matchFound = true;
                            let t1 = performance.now();
                            console.log("Time taken : " + (t1-t0) + " ms");
                            res({ template_match: "Match found", site: site });
                        })
                        .catch((e) => {
                            console.log(e);//promise rejected.
                        })
                    })
                })

            })
        })
    } else if (req.message === 'tabinfo') {
        updateTabInfo(sender.tab, req);
    } else if (req.message === 'get_tabinfo') {
        var tab = req.curtab;
        if (tabInfoList[tab.id] && tabInfoList[tab.id].url === tab.url) {
            res({status: tabInfoList[tab.id].status});
        } else {
            res({status: tab_status.NA});
        }

    } else if (req.message === 'addToWhitelist') {
        addToKPWhiteList(req.site);
    } else if (req.message === 'removeFromWhitelist') {
        removeFromKPWhiteList(req.site);
    }
    return true;

});

chrome.tabs.onRemoved.addListener((tabid, removeinfo) => {
    if (tabInfoList[tabid]) {
        delete tabInfoList[tabid];
    }
});

chrome.runtime.onInstalled.addListener(function(details) {
if (details.reason === 'install') {
        chrome.tabs.create({ url: "option.html" });
    }
});

init();
//function getCurrentTabStatus()
