
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
    }
    return true
})

