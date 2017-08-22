const puppeteer = require('puppeteer');
var Q = require('q');
var fs = require('fs');
var path = path || require('path');
var totalImages = 0;
var matchFound = 0;
var wrongMatch = 0;

// get all the images for directory

var scanDirectory = function(dir) {
    if (!fs.lstatSync(dir).isDirectory()) return dir;
    return fs.readdirSync(dir).map(f => scanDirectory(path.join(dir, f)));
};

// function to encode file data to base64 encoded string
function base64_encode(file) {
    var bitmap = fs.readFileSync(file);
    return new Buffer(bitmap).toString('base64');
}

var testFor = process.argv.slice(3)[0];
if (testFor) {
    testFor = testFor.toLowerCase();
}

// Main function to test screen-shot
async function testImageData(imageUrl) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // load test page
    var expectedLocation = 'file:///' + process.cwd() + '/screenshots/paypal_site.png';
    await page.goto(expectedLocation);
    await page.injectFile('../assets/defaults/pattern.js');
    await page.injectFile('../externalCode/jsfeat.js');
    await page.injectFile('../orb-features.js');

    // print console messages from inside evaluate
    page.on('console', (...args) => {
         console.log("");
        if (`${args[1]}` == 1) {
            console.log('\x1b[32m', `${args[0]}`);
        } else if (`${args[1]}` == 0) {
            console.log('\x1b[31m', `${args[0]}`);
        } else {
            console.log(`${args[0]}`);
        }
    });

    // get base64 data
    let url = "data:image/png;base64," + base64_encode(imageUrl);

    // page actual evaluation
    const data = await page.evaluate(function(url, imageUrl, testFor) {
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
            let matchFoundFlag = false;

            for (let i = 0; i < KPTemplates.length; i++) {
                const template = KPTemplates[i];
                const res = matchOrbFeatures(scrCorners, scrDescriptors, template.patternCorners, template.patternDescriptors, template.site);
                if (res) {
                    let t1 = performance.now();
                    if (testFor) {
                        if (testFor === template.site.toLowerCase()) {

                            matchFoundFlag = true
                            console.log("Match found for  : " + template.site + ", Image Path : " + imageUrl + ", Time taken : " + (t1 - t0) + ", Matches : " + res.matchCount + ", Good Matches : " + res.goodMatches + ", Corners : " + res.ncorners, 1);
                        } else {

                            console.log("Wrong Match found for  : " + template.site + ", Image Path : " + imageUrl + ", Time taken : " + (t1 - t0) + ", Matches : " + res.matchCount + ", Good Matches : " + res.goodMatches + ", Corners : " + res.ncorners, 0);
                        }
                    } else {

                         matchFoundFlag = true
                        console.log("Match found for  : " + template.site + ", Image Path : " + imageUrl + ", Time taken : " + (t1 - t0) + ", Matches : " + res.matchCount + ", Good Matches : " + res.goodMatches + ", Corners : " + res.ncorners, 1);
                    }
                } else {
                    // console.log("No Match found for : " + template.site );
                }
            }

            if (!matchFoundFlag){
                console.log("No Match found for  : " + imageUrl, 0);
            }
        });
        return false
    }, url, imageUrl, testFor);
    await page.screenshot({ path: 'example1.png' });
    browser.close();
    return true
};

// loop for all the images
function forEahImages(images) {
    var targetimage = images.shift()
    if (targetimage) {
        testImageData(targetimage).then(function(url) {
            forEahImages(images)
        }).catch(function(url) {
            console.log('Error loading ' + url)
            forEahImages(images)
        })
    }
}

var images = scanDirectory(process.argv.slice(2)[0]);

forEahImages(images)

// TO run
// node spotphish_test.js screenshots/
