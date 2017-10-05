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

// check template name passed or not
var testFor = process.argv.slice(4)[0];
if (testFor) {
    testFor = testFor.toLowerCase();
    console.log("Testing for: " + testFor)
}

// create separate folder for valid and invalid images
var moveImages = process.argv.slice(3)[0];
if (!moveImages) {
    moveImages = false
}

// Main function to test screen-shot
async function testImageData(imageUrl) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // load test page
    var expectedLocation = 'file:///' + process.cwd() + '/screenshots/paypal_site.png';
    await page.goto(expectedLocation);

    // load required library
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
            console.log('\x1b[1m', `${args[0]}`);
        }
    });

    // get base64 data
    let url = "data:image/png;base64," + base64_encode(imageUrl);

    // page actual evaluation
    totalImages = totalImages + 1;

    // actual main logic
    // inside browser
    const data = await page.evaluate((url, imageUrl) => {
        return new Promise((resolve, reject) => {
            try {
                findOrbFeatures(url)
                .then(result => {
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
                    var resultData = {}
                    // check any template match
                    for (let i = 0; i < KPTemplates.length; i++) {

                        const template = KPTemplates[i];
                        const res = matchOrbFeatures(scrCorners, scrDescriptors, template.patternCorners, template.patternDescriptors, template.site);
                        let t1 = performance.now();

                        if (res) {
                            matchFoundFlag = true
                            resultData.url = imageUrl
                            resultData.mathFound = matchFoundFlag
                            resultData.site = template.site
                            resultData.time = (t1 - t0)
                            resultData.matches = res.matchCount
                            resultData.goodMatches = res.goodMatches
                            resultData.corners = res.ncorners

                            break
                        }else {
                            resultData.url = imageUrl
                            resultData.site = template.site
                            resultData.mathFound = matchFoundFlag
                            resultData.time = (t1 - t0)
                        }
                    }
                    if (!matchFoundFlag){
                    }
                    resolve(resultData);
                })
            } catch (err) {
                reject(err);
            }
        });
    }, url, imageUrl);

    // matchFound = matchFound + data;
    // console.log(data);
    let filter_path = "";
    if(data.mathFound){
        if (testFor) {
            if (testFor === data.site.toLowerCase()) {
                matchFound = matchFound + 1;
                console.log('\x1b[32m', `Match found  : ${data.site}, Image Path : ${data.url}, Time Taken: ${data.time},  Matches : ${data.matches}, Good Matches : ${data.goodMatches}, Corners :  ${data.corners}`);
                filter_path = "valid"

            }else{
                wrongMatch = wrongMatch + 1;
                filter_path = "wrong-path"
                console.log('\x1b[31m', `Match found : ${data.site}, Image Path : ${data.url}, Time Taken: ${data.time},  Matches : ${data.matches}, Good Matches : ${data.goodMatches}, Corners :  ${data.corners}`);
            }
        }else{
            matchFound = matchFound + 1;
            console.log('\x1b[32m', `Match found : ${data.site}, Image Path : ${data.url}, Time Taken: ${data.time},  Matches : ${data.matches}, Good Matches : ${data.goodMatches}, Corners :  ${data.corners}`);
            filter_path = "valid"
        }
    }else{
         console.log('\x1b[31m', `No Match found for  : ${data.url}`);
         filter_path = "invalid"
    }

    if (moveImages){
        moveFile(data.url, filter_path);
    }
    console.log('\x1b[0m', `Total Image Count : ${totalImages}, Total Match Count:  ${matchFound}, Wrong Match: ${wrongMatch}`);
    await page.screenshot({ path: 'spotphish_test.png' });
    browser.close();
    return true
};

var moveFile = (file, path2) => {
  //gets file name and adds it to dir2
      var f = path.basename(file);

      let p = `${path.dirname(file)}/${path2}`;
      if (!fs.existsSync(p)){
            fs.mkdirSync(p);
      }
      var dest = path.resolve(p, f);
      fs.writeFileSync(dest, fs.readFileSync(file));
      //
      // fs.copyFile(file, dest, (err) => {
      //   if(err) throw err;
      // });
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
// node spotphish_test.js screenshots/ "<FILTER true or false>" <template name>
