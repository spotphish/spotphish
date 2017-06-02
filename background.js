
var ts0;
chrome.runtime.onMessage.addListener((req, sender, res) => {
    if (req.message === 'capture') {
        ts0 = performance.now();
        console.log("Recieved message at T : " + ts0);
        chrome.tabs.getSelected(null, (tab) => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (image) => {
                // image is base64

                var matches = [];
                var normalizedImage;
                //TODO:Resolve/reject promise if no match happens
                crop(image, req.area, req.dpr, false, (cropped) => {
                    normalizedImage = cropped;
                    var ts1 = performance.now();
                    console.log("Time taken for snapshot : " + (ts1 - ts0) + " ms");

                    whiteList.forEach(function (value) {
                        matches.push(matchBriefFeatures(normalizedImage, value))
                    });

                   // for (i = 0; i < whiteList.length; i++) {
                   //      // console.log(whiteList[i], normalizedImage);
                   //      matches[i] = matchTemplate(normalizedImage, whiteList[i]);
                   //  }

                    Promise.race(matches).then((site) => {
                        // console.log("After promise");
                        matchFound = true;
                        res({ template_match: "Match found", site: site });
                    })
                    .catch((e) => {
                        console.log(e);//promise rejected.
                    })
                })

            })
        })
    }
    return true
})

