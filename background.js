
var debug = false, 
    globalCurrentTabId,
    tabInfoList = {},
    KPWhiteList,
    KPSkipList,
    objWhitelist,
    KPRedFlagList,
    whiteListedUrls;


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
            console.log("Data received : ", data);
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
            console.log("Data received : ", data);
            if (data) {
                KPRedFlagList = data;
            } else {
                KPRedFlagList = redFlagSites;
                saveKPRedFlagList();
            }
    });
}

function init() {
    syncWhiteList();
    syncSkipList();
    syncRedFlagList();
    objWhitelist = new IDBStore({
            storeName: 'whitelist',
            keyPath: 'id',
            autoIncrement: true,
            onStoreReady: initWhitelist
    });

}


function addToKPWhiteList(site) {
    var index = KPWhiteList.indexOf(site);
    if (index !== -1) {
        console.log("Already in list : ", site);
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
                var normalizedImage;
                //TODO:Resolve/reject promise if no match happens
                crop(image, req.area, req.dpr, false, (cropped) => {
                    normalizedImage = cropped;
                    KPRedFlagList.forEach(function (value) {
                        if (value.enabled) {
                            matches.push(matchBriefFeatures(normalizedImage, value));
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
        console.log("In Add to whitelist");
        inject(req.currentTab, req.site);
    } else if (req.message === 'removeFromWhitelist') {
        removeFromKPWhiteList(req.site);
    } else if (req.message === 'crop_capture') {
        console.log("Inside crop capture");
        chrome.tabs.getSelected(null, (tab) => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (image) => {
                crop(image, req.area, req.dpr, true, (cropped) => {
                        res({message: 'image', image: cropped});
                        var url = stripQueryParams(sender.tab.url);
                        console.log ("URL: ", url, " tab: ", sender.tab);
                        objWhitelist.put({ url: url, type: "custom", logo: cropped, site: getPathInfo(url).host })
                })
            })
        })
    } else if (req.message === 'add_wh') {
        //TODO: Put into whitelist
        var url = stripQueryParams(sender.tab.url);
        console.log ("URL: ", url, " tab: ", sender.tab);
        objWhitelist.put({ url: url, type: "custom", site: getPathInfo(url).host })
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
        objWhitelist.clear();
        chrome.tabs.create({ url: "option.html" });
    }
});

init();
//function getCurrentTabStatus()
function inject (tab, site) {
  chrome.tabs.sendMessage(tab.id, {message: 'init', url: site}, (res) => {
    if (res) {
      //clearTimeout(timeout)
    }
  })
/*
  var timeout = setTimeout(() => {
    chrome.tabs.insertCSS(tab.id, {file: 'vendor/jquery.Jcrop.min.css', runAt: 'document_start'})
    chrome.tabs.insertCSS(tab.id, {file: 'css/content1.css', runAt: 'document_start'})

    chrome.tabs.executeScript(tab.id, {file: 'vendor/jquery.min.js', runAt: 'document_start'})
    chrome.tabs.executeScript(tab.id, {file: 'vendor/jquery.Jcrop.min.js', runAt: 'document_start'})
    chrome.tabs.executeScript(tab.id, {file: 'content1.js', runAt: 'document_start'})

    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, {message: 'init'})
    }, 100)
  }, 100)
*/
}
/*
chrome.browserAction.onClicked.addListener((tab) => {
  inject(tab)
})
*/
/* Indexed DB related functions */

function initWhitelist(site, cb) {
    objWhitelist.getAll((data) => {
        if (data.length <= 0) {
            objWhitelist.putBatch(redFlagSites);
        }
        var data1 = data.map((x) => {
            return {id: x.id, url: x.url, type: x.type, site: x.site, logo: x.logo}
        });
        whiteListedUrls = data.map((x) => {
            return x.url;
        });
        if (cb) {
            cb(data1);
        }
    })
}


function removeFromWhiteListById(id) {
    objWhitelist.remove(id);
}

