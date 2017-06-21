
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
