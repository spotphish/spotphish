var system = require('system');
var args = system.args;
var fs = require('fs');
var colors = require('colors');
if (system.args.length == 4) {
    console.log("Starting....");
}else{
    console.log("Pass the corrects arguments".red);
    phantom.exit();
}
var redFlagList = system.args[1]
var KPRedFlagList = JSON.parse(fs.read(system.args[1]));
var num_train_levels = 4
var match_threshold = 48;
var promiseTimeout = 5000; //in ms
var blurSize = 5;
var totalImages = 0;
var matchFound = 0;
var matchReults = []

var testFor = system.args[3].toLowerCase() || null;

// estimate homography transform between matched points
function findTransform(scrShot_corners, patternCorners, matches, count, homo3x3, match_mask) {
    // motion kernel
    var mm_kernel = new jsfeat.motion_model.homography2d();
    // ransac params
    var num_model_points = 4;
    var reproj_threshold = 3;
    var ransac_param = new jsfeat.ransac_params_t(num_model_points,
        reproj_threshold, 0.5, 0.99);

    var pattern_xy = [];
    var screen_xy = [];

    // construct correspondences
    for (var i = 0; i < count; ++i) {
        var m = matches[i];
        var s_kp = scrShot_corners[m.screen_idx];
        var p_kp = patternCorners[m.pattern_lev][m.pattern_idx];
        pattern_xy[i] = { "x": p_kp.x, "y": p_kp.y };
        screen_xy[i] = { "x": s_kp.x, "y": s_kp.y };
    }

    // estimate motion
    var ok = false;
    ok = jsfeat.motion_estimator.ransac(ransac_param, mm_kernel,
        pattern_xy, screen_xy, count, homo3x3, match_mask, 1000);

    // extract good matches and re-estimate
    var good_cnt = 0;
    if (ok) {
        for (var i = 0; i < count; ++i) {
            if (match_mask.data[i]) {
                pattern_xy[good_cnt].x = pattern_xy[i].x;
                pattern_xy[good_cnt].y = pattern_xy[i].y;
                screen_xy[good_cnt].x = screen_xy[i].x;
                screen_xy[good_cnt].y = screen_xy[i].y;
                good_cnt++;
            }
        }
        // run kernel directly with inliers only
        mm_kernel.run(pattern_xy, screen_xy, homo3x3, good_cnt);
    } else {
        jsfeat.matmath.identity_3x3(homo3x3, 1.0);
    }

    return good_cnt;
}


// non zero bits count
function popcnt32(n) {
    n -= ((n >> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    return (((n + (n >> 4)) & 0xF0F0F0F) * 0x1010101) >> 24;
}

// wait for any function
function waitFor(testFx, onReady, url) {
    var maxtimeOutMillis = 3000,
        start = new Date().getTime(),
        condition = false,
        interval = setInterval(function() {
            if ((new Date().getTime() - start < maxtimeOutMillis) && !condition) {
                // If not time-out yet and condition not yet fulfilled
                condition = testFx();
            } else {
                if (!condition) {
                    console.log(url);
                    console.log("'waitFor()' timeout");
                    // clearInterval(interval);
                    // return condition
                } else {
                    typeof(onReady) === "string" ? eval(onReady): onReady(condition);
                    clearInterval(interval);
                }
            }
        }, 300);
};

var match_t = (function() {
    function match_t(screen_idx, pattern_lev, pattern_idx, distance) {
        if (typeof screen_idx === "undefined") { screen_idx = 0; }
        if (typeof pattern_lev === "undefined") { pattern_lev = 0; }
        if (typeof pattern_idx === "undefined") { pattern_idx = 0; }
        if (typeof distance === "undefined") { distance = 0; }

        this.screen_idx = screen_idx;
        this.pattern_lev = pattern_lev;
        this.pattern_idx = pattern_idx;
        this.distance = distance;
    }
    return match_t;
})();
// match Pattern
function matchPattern(scrShot_descriptors, patternDescriptors, matches) {
    // console.log("matches", matches);
    var q_cnt = scrShot_descriptors.rows;
    var query_du8 = scrShot_descriptors.data;
    var query_u32 = scrShot_descriptors.buffer.i32; // cast to integer buffer
    var qd_off = 0;
    var qidx = 0,
        lev = 0,
        pidx = 0,
        k = 0;
    var num_matches = 0;

    for (qidx = 0; qidx < q_cnt; ++qidx) {
        var best_dist = 256;
        var best_dist2 = 256;
        var best_idx = -1;
        var best_lev = -1;

        for (lev = 0; lev < num_train_levels; ++lev) {
            var lev_descr = patternDescriptors[lev];
            var ld_cnt = lev_descr.rows;
            var ld_i32 = lev_descr.buffer.i32; // cast to integer buffer
            var ld_off = 0;

            for (pidx = 0; pidx < ld_cnt; ++pidx) {

                var curr_d = 0;
                // our descriptor is 32 bytes so we have 8 Integers
                for (k = 0; k < 8; ++k) {
                    curr_d += popcnt32(query_u32[qd_off + k] ^ ld_i32[ld_off + k]);
                }

                if (curr_d < best_dist) {
                    best_dist2 = best_dist;
                    best_dist = curr_d;
                    best_lev = lev;
                    best_idx = pidx;
                } else if (curr_d < best_dist2) {
                    best_dist2 = curr_d;
                }

                ld_off += 8; // next descriptor
            }
        }

        // filter out by some threshold
        if (best_dist < match_threshold) {
            matches[num_matches] = new match_t();
            matches[num_matches].screen_idx = qidx;
            matches[num_matches].pattern_lev = best_lev;
            matches[num_matches].pattern_idx = best_idx;
            num_matches++;
        }

        qd_off += 8; // next query descriptor
    }

    return num_matches;
}


function matchOrbFeatures(scrCorners, scrDescriptors, patternCorners, patternDescriptors, site, url) {
    totalImages = totalImages + 1;
    if (totalImages > 9) {
        var imgNo = (totalImages / 9) >> 0;

    } else {
        var imgNo = 0;
    }
    var matchHash = {}
    matchHash.path = url;
    var match_threshold = 48; //increasing this increases the number of points found. hence increases noise.
    //data strs for the screenshot
    var matches, homo3x3, match_mask;

    var t0 = performance.now();
    matches = [];

    // transform matrix
    homo3x3 = new jsfeat.matrix_t(3, 3, jsfeat.F32C1_t);
    match_mask = new jsfeat.matrix_t(500, 1, jsfeat.U8C1_t);

    var num_matches = 0;
    var good_matches = 0;
    num_matches = matchPattern(scrDescriptors, patternDescriptors, matches);
    // console.log("Matches count : " + num_matches);
    good_matches = findTransform(scrCorners, patternCorners, matches, num_matches, homo3x3, match_mask);
    var t1 = performance.now();
    // console.log("Good matches count : " + good_matches);
    // console.log("Time taken : " + (t1 - t0));
    if (testFor) {
        if (good_matches > 8) {
            matchFound = matchFound + 1;
            if (testFor === site.toLowerCase()) {
                var result = "Match: path: " + url + ", Match Templates: " + site + ", Good Matches:" + good_matches;
                console.log(colors.green(result));
            } else {
                var result = "Wrong Match: path: " + url + ", Match Templates: " + site + ", Good Matches:" + good_matches;
                console.log(colors.red(result));
            }
        } else {
            var result = "No Match:  path: " + url + ", Match Templates: " + site + ", Good Matches:" + good_matches;
            if (testFor === site.toLowerCase()) {
                console.log(colors.red(result));
            }
        }
    } else {
        if (good_matches > 8) {
            matchFound = matchFound + 1;
            var result = "Match: Image path: " + url + ", Match Templates: " + site + ", Good Matches:" + good_matches + ""
            console.log(colors.green(result));
        } else {
            var result = "No Match: path: " + url + ", Match Templates: " + site + ", Good Matches:" + good_matches + ""
            console.log(colors.yellow(result));
        }
    }
}

// Get image source and camprare with all templates
function getSourceImageData(data, url) {
    var srcImage = {}
    var scrShot_u8 = new jsfeat.matrix_t(data.width, data.height, jsfeat.U8_t | jsfeat.C1_t);
    var scrShot_u8_smooth = new jsfeat.matrix_t(data.width, data.height, jsfeat.U8_t | jsfeat.C1_t);
    var scrCorners = [];
    var scrDescriptors = new jsfeat.matrix_t(32, 500, jsfeat.U8_t | jsfeat.C1_t);
    var i = data.width * data.height;
    while (--i >= 0) {
        scrCorners[i] = new jsfeat.keypoint_t(0, 0, 0, 0, -1);
    }

    jsfeat.imgproc.grayscale(data.image.data, data.width, data.height, scrShot_u8);
    jsfeat.imgproc.gaussian_blur(scrShot_u8, scrShot_u8_smooth, 5);
    var num_scrShot_corners = jsfeat.fast_corners.detect(scrShot_u8_smooth, scrCorners, 3);
    jsfeat.orb.describe(scrShot_u8_smooth, scrCorners, num_scrShot_corners, scrDescriptors);

    KPRedFlagList.forEach(function(value, i) {
        if (value.enabled) {
            matchOrbFeatures(
                scrCorners,
                scrDescriptors,
                value.patternCorners,
                value.patternDescriptors,
                value.templateName,
                url
            );
        }
    });
}

// open website or scrren shots
function toOpen(url, dirPath) {
    setInterval(function() {}, 500);
    var webPage = require('webpage');
    var page = webPage.create();
    page.onConsoleMessage = function(msg) {
        console.log(msg);
    };

    var expectedContent = '<html><body><img id="image1" src="' + url + '"></img><canvas id="canvas"></canvas></body></html>';
    var expectedLocation = 'file:///'+ dirPath  +'/test-sample111.html';
    page.setContent(expectedContent, expectedLocation);

    //on page load function
    page.onLoadFinished = function() {
        filename = '../jsfeat-min.js';
        injected = phantom.injectJs(filename);
        var t0 = performance.now();

        var data = page.evaluate(function() {
            var temp_canv = document.createElement('canvas');
            var img = document.getElementById('image1');
            var imageData = {};
            var context = temp_canv.getContext('2d');
            temp_canv.width = img.width;
            temp_canv.height = img.height;
            imageData.width = img.width;
            imageData.height = img.height;
            context.drawImage(img, 0, 0, img.width, img.height);
            imageData.image = context.getImageData(0, 0, img.width, img.height);
            return imageData
        });

        setInterval(function() {}, 3000);
        data
        var srcImage = getSourceImageData.call(this, data, url);
    }
}



// Read all the files from screen shoots
var scanDirectory = function(path) {
    var fs = require('fs');
    if (fs.exists(path) && fs.isFile(path)) {
        // console.log("New image");
        var dirPath = fs.workingDirectory;
        var imgpath = fs.workingDirectory + "/" + path;
        // var imgpath = fs.workingDirectory + "/" + path;
        toOpen(imgpath, dirPath);
    } else if (fs.isDirectory(path)) {
        fs.list(path).forEach(function(e) {
            if (e !== "." && e !== "..") { //< Avoid loops
                scanDirectory(path + '/' + e);
            }
        });
    }
};
// toOpen('file:///Users/deepakshinde/work/killphisher/test/coriolis.png')
scanDirectory(system.args[2]);
// TO Run
// phantomjs sample5.JS img/pattern.json screenshots --web-security=no
