var num_train_levels = 4
var match_threshold = 48;
var promiseTimeout = 5000; //in ms
var blurSize = 5; 
var match_t = (function () {
    function match_t(screen_idx, pattern_lev, pattern_idx, distance) {
        if (typeof screen_idx === "undefined") { screen_idx=0; }
        if (typeof pattern_lev === "undefined") { pattern_lev=0; }
        if (typeof pattern_idx === "undefined") { pattern_idx=0; }
        if (typeof distance === "undefined") { distance=0; }

        this.screen_idx = screen_idx;
        this.pattern_lev = pattern_lev;
        this.pattern_idx = pattern_idx;
        this.distance = distance;
    }
    return match_t;
})();

function detect_keypoints(img, corners, max_allowed) {
    // detect features
    var count = jsfeat.yape06.detect(img, corners, 17);

    // sort by score and reduce the count if needed
    if(count > max_allowed) {
        jsfeat.math.qsort(corners, 0, count-1, function(a,b){return (b.score<a.score);});
        count = max_allowed;
    }

    // calculate dominant orientation for each keypoint
    for(var i = 0; i < count; ++i) {
        corners[i].angle = ic_angle(img, corners[i].x, corners[i].y);
    }

    return count;
}

// central difference using image moments to find dominant orientation
var u_max = new Int32Array([15,15,15,15,14,14,14,13,13,12,11,10,9,8,6,3,0]);
function ic_angle(img, px, py) {
    var half_k = 15; // half patch size
    var m_01 = 0, m_10 = 0;
    var src=img.data, step=img.cols;
    var u=0, v=0, center_off=(py*step + px)|0;
    var v_sum=0,d=0,val_plus=0,val_minus=0;

    // Treat the center line differently, v=0
    for (u = -half_k; u <= half_k; ++u)
        m_10 += u * src[center_off+u];

    // Go line by line in the circular patch
    for (v = 1; v <= half_k; ++v) {
        // Proceed over the two lines
        v_sum = 0;
        d = u_max[v];
        for (u = -d; u <= d; ++u) {
            val_plus = src[center_off+u+v*step];
            val_minus = src[center_off+u-v*step];
            v_sum += (val_plus - val_minus);
            m_10 += u * (val_plus + val_minus);
        }
        m_01 += v * v_sum;
    }

    return Math.atan2(m_01, m_10);
}

// non zero bits count
function popcnt32(n) {
    n -= ((n >> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    return (((n + (n >> 4))& 0xF0F0F0F)* 0x1010101) >> 24;
}

function match_pattern(scrShot_descriptors, patternDescriptors, matches) {
    var q_cnt = scrShot_descriptors.rows;
    var query_du8 = scrShot_descriptors.data;
    var query_u32 = scrShot_descriptors.buffer.i32; // cast to integer buffer
    var qd_off = 0;
    var qidx=0,lev=0,pidx=0,k=0;
    var num_matches = 0;

    for(qidx = 0; qidx < q_cnt; ++qidx) {
        var best_dist = 256;
        var best_dist2 = 256;
        var best_idx = -1;
        var best_lev = -1;

        for(lev = 0; lev < num_train_levels; ++lev) {
            var lev_descr = patternDescriptors[lev];
            var ld_cnt = lev_descr.rows;
            var ld_i32 = lev_descr.buffer.i32; // cast to integer buffer
            var ld_off = 0;

            for(pidx = 0; pidx < ld_cnt; ++pidx) {

                var curr_d = 0;
                // our descriptor is 32 bytes so we have 8 Integers
                for(k=0; k < 8; ++k) {
                    curr_d += popcnt32( query_u32[qd_off+k]^ld_i32[ld_off+k] );
                }

                if(curr_d < best_dist) {
                    best_dist2 = best_dist;
                    best_dist = curr_d;
                    best_lev = lev;
                    best_idx = pidx;
                } else if(curr_d < best_dist2) {
                    best_dist2 = curr_d;
                }

                ld_off += 8; // next descriptor
            }
        }

        // filter out by some threshold
        if(best_dist < match_threshold) {
            matches[num_matches].screen_idx = qidx;
            matches[num_matches].pattern_lev = best_lev;
            matches[num_matches].pattern_idx = best_idx;
            num_matches++;
        }

        qd_off += 8; // next query descriptor
    }

    return num_matches;
}

// estimate homography transform between matched points
function find_transform(scrShot_corners, patternCorners, matches, count, homo3x3, match_mask) {
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
    for(var i = 0; i < count; ++i) {
        var m = matches[i];
        var s_kp = scrShot_corners[m.screen_idx];
        var p_kp = patternCorners[m.pattern_lev][m.pattern_idx];
        pattern_xy[i] = {"x":p_kp.x, "y":p_kp.y};
        screen_xy[i] =  {"x":s_kp.x, "y":s_kp.y};
    }

    // estimate motion
    var ok = false;
    ok = jsfeat.motion_estimator.ransac(ransac_param, mm_kernel,
                                        pattern_xy, screen_xy, count, homo3x3, match_mask, 1000);

    // extract good matches and re-estimate
    var good_cnt = 0;
    if(ok) {
        for(var i=0; i < count; ++i) {
            if(match_mask.data[i]) {
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
const loadImage = (imageUrl, canvasElement) => {
    return new Promise((resolve) => {
        let image = new Image();
        image.onload = () => {
            if (canvasElement) {
                canvasElement.width = image.width;
                canvasElement.height = image.height;
            }

            resolve(image);
        };

        image.src = imageUrl;
    });
};

function findOrbFeatures(screenShot) {
    return new Promise((resolve) => {
        Promise.all([loadImage(screenShot)]).then((result) => {
            var image = result[0];
            var canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, image.width, image.height);
            var imageData1 = ctx.getImageData(0, 0, image.width, image.height);
            
            var scrShot_u8 = new jsfeat.matrix_t(image.width, image.height, jsfeat.U8_t | jsfeat.C1_t);
            var scrShot_u8_smooth = new jsfeat.matrix_t(image.width, image.height, jsfeat.U8_t | jsfeat.C1_t); 
            var scrCorners = [];
	        var scrDescriptors= new jsfeat.matrix_t(32, 500, jsfeat.U8_t | jsfeat.C1_t);
            var i = image.width * image.height;
            while(--i >= 0) {
                scrCorners[i] = new jsfeat.keypoint_t(0,0,0,0,-1);
            }

            jsfeat.imgproc.grayscale(imageData1.data, image.width, image.height, scrShot_u8);
            jsfeat.imgproc.gaussian_blur(scrShot_u8, scrShot_u8_smooth, blurSize);
            var num_scrShot_corners = jsfeat.fast_corners.detect(scrShot_u8_smooth, scrCorners, 3);
            jsfeat.orb.describe(scrShot_u8_smooth, scrCorners, num_scrShot_corners, scrDescriptors);
            var result = {};
            result.corners = scrCorners;
            result.descriptors = scrDescriptors;
            resolve(result);
        })
    })
}

//TODO
/*function createPatterns(logo, patternCorners, patternDescriptors) {
 
    //data strs for patten/logo
    var max_pattern_size = 512;
    var max_per_level = 300;
    var sc_pc = 0.25;//Math.sqrt(2.0); // magic number ;)
    var lev0_img = new jsfeat.matrix_t(image1.width, image1.height, jsfeat.U8_t | jsfeat.C1_t);
    var lev_img = new jsfeat.matrix_t(image1.width, image1.height, jsfeat.U8_t | jsfeat.C1_t);
    var lev_corners, lev_descr;
    var corners_num=0;
    var sc = 1.0;
    jsfeat.imgproc.grayscale(imageData1.data, image1.width, image1.height, lev0_img);
    for(lev=0; lev < num_train_levels; ++lev) {
        patternCorners[lev] = [];
        lev_corners = patternCorners[lev];

        // preallocate corners array
        i = (image1.width * image1.height) >> lev;
        while(--i >= 0) {
            lev_corners[i] = new jsfeat.keypoint_t(0,0,0,0,-1);
        }

        patternDescriptors[lev] = new jsfeat.matrix_t(32, max_per_level, jsfeat.U8_t | jsfeat.C1_t);
    }

    // do the first level
    lev_corners = patternCorners[0];
    lev_descr = patternDescriptors[0];

    jsfeat.imgproc.gaussian_blur(lev0_img, lev_img, blur_size); // this is more robust
    //corners_num = detect_keypoints(lev_img, lev_corners, max_per_level);
    corners_num = jsfeat.fast_corners.detect(lev_img, lev_corners, 3);
    jsfeat.orb.describe(lev_img, lev_corners, corners_num, lev_descr);

    console.log("train " + lev_img.cols + "x" + lev_img.rows + " points: " + corners_num);

    sc -= sc_pc;

    // lets do multiple scale levels
    // we can use Canvas context draw method for faster resize
    // but its nice to demonstrate that you can do everything with jsfeat
    for(lev = 1; lev < num_train_levels; ++lev) {
        lev_corners = patternCorners[lev];
        lev_descr = patternDescriptors[lev];

        new_width = (lev0_img.cols*sc)|0;
        new_height = (lev0_img.rows*sc)|0;

        jsfeat.imgproc.resample(lev0_img, lev_img, new_width, new_height);
        jsfeat.imgproc.gaussian_blur(lev_img, lev_img, blur_size);
        //corners_num = detect_keypoints(lev_img, lev_corners, max_per_level);
        corners_num = jsfeat.fast_corners.detect(lev_img, lev_corners, 3);
        jsfeat.orb.describe(lev_img, lev_corners, corners_num, lev_descr);

        // fix the coordinates due to scale level
        for(i = 0; i < corners_num; ++i) {
            lev_corners[i].x *= 1./sc;
            lev_corners[i].y *= 1./sc;
        }

        console.log("train " + lev_img.cols + "x" + lev_img.rows + " points: " + corners_num);

        sc -= sc_pc;
    }
}*/

const matchOrbFeatures = (scrCorners, scrDescriptors, patternCorners, patternDescriptors, site) => {
    return new Promise((resolve, reject) => {
        setTimeout(function() {
            reject("No match found");
        }, promiseTimeout);
        //Params to play around with
        var match_threshold = 48;//increasing this increases the number of points found. hence increases noise.

        //data strs for the screenshot
        var  matches, homo3x3, match_mask;
        
        var t0 = performance.now();
        matches = [];
        var i = 500;
        while(--i >= 0) {
            matches[i] = new match_t();
        }

        // transform matrix
        homo3x3 = new jsfeat.matrix_t(3,3,jsfeat.F32C1_t);
        match_mask = new jsfeat.matrix_t(500,1,jsfeat.U8C1_t);
        
        var num_matches = 0;
        var good_matches = 0;
        num_matches = match_pattern(scrDescriptors, patternDescriptors, matches);
        console.log("Matches count : " + num_matches);
        good_matches = find_transform(scrCorners, patternCorners,matches, num_matches, homo3x3, match_mask);
        var t1 = performance.now();
        console.log("Good matches count : " + good_matches);
        console.log("Time taken : " + (t1 - t0));
        if(good_matches > 8) {
            console.log("Match found for : " + site);
            resolve(site);
        }

    });
}


const matchBriefFeatures = (screenShot, template) => {
    return new Promise((resolve, reject) => {
        setTimeout(function() {
            reject("No match found");
        }, promiseTimeout);
        let p = Promise.all([loadImage(screenShot), loadImage(template.logo)]);
        Promise.all([p]).then((results) => {
            var image1 = results[0][1];
            var image2 = results[0][0];
            var canvas = document.createElement('canvas');
            canvas.width = image1.width + image2.width + 200;
            canvas.height = image1.height + image2.height + 200;
            var context = canvas.getContext('2d');


            let descriptorLength = 256;
            let matchesShown = 10;
            let blurRadius = 3;

			var isBindingRect = function(matches, diagonalDist) {
				var nearestPixel = matches[1].keypoint2;
				var BoundPixels = 0;
				for (var i = 1; i < matches.length; i++) {
					var x = matches[i].keypoint2[0] - nearestPixel[0];
					var y = matches[i].keypoint2[1] - nearestPixel[1];
					var dist = Math.sqrt(x*x, y*y);
					if (dist < diagonalDist)
						BoundPixels++;
				}
				console.log("BoundPixels : " + BoundPixels);
				return BoundPixels;
			} 
            var isMatch = function(matches) {
                var confCount = 0;
                for (var i = 0; i < matches.length; i++) {
                    console.log(matches[i]);
                    if (matches[i].confidence > 0.89)
                        confCount++;
                }
                console.log("Conf count : " + confCount);
                return confCount;
            }

            tracking.Brief.N = descriptorLength;
            console.log(image1.width);
            console.log(image2.width);
            context.drawImage(image1, 0, 0, image1.width, image1.height);
            context.drawImage(image2, 200, 0, image2.width, image2.height);

            var imageData1 = context.getImageData(0, 0, image1.width, image1.height);
            var imageData2 = context.getImageData(200, 0, image2.width, image2.height);

            var gray1 = tracking.Image.grayscale(tracking.Image.blur(imageData1.data, image1.width, image1.height, blurRadius), image1.width, image1.height);
            var gray2 = tracking.Image.grayscale(tracking.Image.blur(imageData2.data, image2.width, image2.height, blurRadius), image2.width, image2.height);

            var corners1 = tracking.Fast.findCorners(gray1, image1.width, image1.height);
            var corners2 = tracking.Fast.findCorners(gray2, image2.width, image2.height);

            var descriptors1 = tracking.Brief.getDescriptors(gray1, image1.width, corners1);
            var descriptors2 = tracking.Brief.getDescriptors(gray2, image2.width, corners2);

            var matches = tracking.Brief.reciprocalMatch(corners1, descriptors1, corners2, descriptors2);

            matches.sort(function(a, b) {
                return b.confidence - a.confidence;
            });
            var topMatches = matches.slice(0, 10);
            let matchPixels = isMatch(topMatches);
            let boundPixels = isBindingRect(topMatches,template.diagDist); 
            if ((matchPixels > 8) && (boundPixels >= 7)) {
                console.log("Match found for : " + template.site);
                resolve(template.site);
            }
        });
    })
}
