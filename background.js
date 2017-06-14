
var debug = false, 
    globalCurrentTabId,
    tabInfoList = {},
    KPWhiteList;


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

function checkWhitelist(domain) {
    var list = KPWhiteList;
    var length = list.length();
    for (var i = 0; i < length; i++ ) {
        if (domain.endsWith(list[i])) {
            console.log("WHITE LISTED : ", list[i]);
            return true;
        }
    }
    return false;
}

function saveKPWhiteList() {
    chrome.storage.local.set({whitelist : KPWhiteList},() => {
        console.log("whitelist : ", KPWhiteList )
        });
}

function syncWhiteList(){
    chrome.storage.local.get("whitelist", function(result) {
        var data = result.whitelist;
            console.log("Data received : ", data );
            if (data) {
                KPWhiteList = data;
            } else {
                KPWhiteList = whiteListedDomains;
                saveKPWhiteList();
            }
    });
}

function init() {
    syncWhiteList();
}

function addToKPWhiteList(domain) {
    if (domain in KPWhiteList) {
        return;
    }
    KPWhiteList.push(domain);
    saveKPWhiteList();
}

function removeFromKPWhiteList(domain) {
    var index = KPWhiteList.indexOf(domain);
    if (index !== -1) {
        KPWhiteList.splice(index,1);
        saveKPWhiteList();
    } else {
        console.log("Domain not Whitelisted : ", domain);
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
                    whiteList.forEach(function (value) {
                        matches.push(matchBriefFeatures(normalizedImage, value))
                    });

                   // for (i = 0; i < whiteList.length; i++) {
                   //      // console.log(whiteList[i], normalizedImage);
                   //      matches[i] = matchTemplate(normalizedImage, whiteList[i]);
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
        addToKPWhiteList(req.domain);
    } else if (req.message === 'removeFromWhitelist') {
        removeFromKPWhiteList(req.domain);
    }
    return true;

});

chrome.tabs.onRemoved.addListener((tabid, removeinfo) => {
    if (tabInfoList[tabid]) {
        delete tabInfoList[tabid];
    }
});


init();
//function getCurrentTabStatus()
