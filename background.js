
var debug = false, 
    globalCurrentTabId,
    KPSkipList,
    objWhitelist,
    KPRedFlagList,
    whiteListedUrls;


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
    syncSkipList();
    syncRedFlagList();
    objWhitelist = new IDBStore({
            storeName: 'whitelist',
            keyPath: 'id',
            autoIncrement: true,
            onStoreReady: initWhitelist,
            indexes: [
                { name: 'url', keyPath: 'url', unique: false, multiEntry: false }
            ]
    });

}

function addToKPSkipList(domain) {
    var index = KPSkipList.indexOf(site);
    if (index !== -1) {
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
    } else if (req.message === 'addToWhitelist') {
        //addToKPWhiteList(req.site);
        inject(req.currentTab, req.site);
    } else if (req.message === 'removeFromWhitelist') {
        //removeFromKPWhiteList(req.site);
        //TODO: write function to remove from whitelist by URL
    } else if (req.message === 'crop_capture') {
        console.log("Inside crop capture");
        chrome.tabs.getSelected(null, (tab) => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (image) => {
                crop(image, req.area, req.dpr, true, (cropped) => {
                        res({message: 'image', image: cropped});
                        var url = stripQueryParams(sender.tab.url);
                        console.log ("URL: ", url, " tab: ", sender.tab);
                        addToWhiteList({ url: url, type: "custom", logo: cropped, site: getPathInfo(url).host, enabled: true});
                })
            })
        })
    } else if (req.message === 'add_wh') {
        //TODO: Put into whitelist
        var url = stripQueryParams(sender.tab.url);
        console.log ("URL: ", url, " tab: ", sender.tab);
        addToWhiteList({ url: url, type: "custom", site: getPathInfo(url).host, enabled: true});
    } else if (req.message === 'wl_check') {
        var stripUrl = (req.url)? req.url:stripQueryParams(sender.tab.url);
        console.log("request : ", req);
        res({whitelist : isWhitelisted(stripUrl)});
    }
    return true;

});

chrome.runtime.onInstalled.addListener(function(details) {
if (details.reason === 'install') {
        //objWhitelist.clear();
        chrome.tabs.create({ url: "option.html" });
    }
});

init();
//function getCurrentTabStatus()
function inject (tab, site) {
    chrome.tabs.sendMessage(tab.id, {message: 'init', url: site});
}
/* Indexed DB related functions */

function initWhitelist(cb) {
    objWhitelist.getAll((data) => {
        if (data.length <= 0) {
            objWhitelist.putBatch(redFlagSites);
        }
        var data1 = data.map((x) => {
            return {id: x.id, url: x.url, type: x.type, site: x.site, logo: x.logo, enabled: x.enabled}
        });
        whiteListedUrls = data1.filter((x)=> {
            return x.url !== undefined;
        }).map((x) => {
            return {url: x.url, type: x.type, enabled: x.enabled};
        });
        if (cb) {
            cb(data1);
        }
    })
}


function removeFromWhiteListById(id) {
    objWhitelist.remove(id);
}

function addToWhiteList(data) {
    objWhitelist.put(data, (x) => {
        initWhitelist();
        console.log("Add: ", x);
    });
}

function isWhitelisted(url) {
    var data = whiteListedUrls.filter((x)=> {
        return x.enabled;
    }).filter((x) => {
        return x.url === url;
    })
    if (data.length > 0) {
        return true;
    }
    return false;
}
