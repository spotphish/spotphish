const puppeteer = require('puppeteer');
var fs = require('fs');
(async() => {

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const page1 = await browser.newPage();
    var expectedLocation = 'file:///' + process.cwd() + '/screenshots/paypal_site.png';
    await page.goto(expectedLocation);

    // inject required files

    await page.injectFile('../assets/defaults/pattern.js');
    await page.injectFile('../externalCode/jsfeat.js');
    await page.injectFile('../orb-features.js');

    // print console messages from inside evaluate
    page.on('console', (...args) => {
        if (`${args[1]}` == 1) {
            console.log('\x1b[32m', `${args[0]}`);
        } else if (`${args[1]}` == 0) {
            console.log('\x1b[31m', `${args[0]}`);
        } else {
            console.log('\x1b[31m', `${args[0]}`);
        }
    });

    // function to encode file data to base64 encoded string
    function base64_encode(file) {
        var bitmap = fs.readFileSync(file);
        return new Buffer(bitmap).toString('base64');
    }

    // get host name for screen-shot name
    function extractHostname(url) {
        var hostname;
        if (url.indexOf("://") > -1) {
            hostname = url.split('/')[2];
        } else {
            hostname = url.split('/')[0];
        }

        hostname = hostname.split(':')[0];
        hostname = hostname.split('?')[0];
        hostname = hostname.replace(/\./g, '_');
        return hostname;
    }

    let pageUrl = process.argv.slice(2)[0]
    let pageName = `screenshots/${extractHostname(pageUrl)}.png`;
    await page1.goto(pageUrl);
    await page1.screenshot({ path: pageName, fullPage: true });

    let url = "data:image/png;base64," + base64_encode(pageName);

    const data = await page.evaluate(function(url) {
        findOrbFeatures(url).then(result => {
            scrCorners = result.corners;
            scrDescriptors = result.descriptors;
            var res = [];

            defPatterns.forEach((x) => {
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

            const KPTemplates = res.filter((x) => {
                return x.logo !== undefined && x.enabled === true;
            }).map((x) => {
                return { id: x.id, url: x.url, site: x.site, logo: x.logo, enabled: x.enabled, patternCorners: x.patternCorners, patternDescriptors: x.patternDescriptors };
            });

            let t0 = performance.now();
            for (let i = 0; i < KPTemplates.length; i++) {
                const template = KPTemplates[i];
                const res = matchOrbFeatures(scrCorners, scrDescriptors, template.patternCorners, template.patternDescriptors, template.site);
                if (res) {
                    let t1 = performance.now();
                    console.log("Match found for : " + template.site + ", Time taken : " + (t1 - t0) + ", Matches : " + res.matchCount + ", Good Matches : " + res.goodMatches + ", Corners : " + res.ncorners, 1);
                } else {
                    console.log("No Match found for : " + template.site, 0);
                }
            }
        });
        return false
    }, url);
    await page.screenshot({ path: 'test.png' });
    browser.close();
})();

// TO run
// node webpage_test.js  "https://www.paypal.com/signin?country.x=IN&locale.x=en_IN"
