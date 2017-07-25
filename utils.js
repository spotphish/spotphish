"use strict";
var VERBOSE = false;
const tab_status = {
    NA: 0,
    WHITELISTED: 1,
    NOT_WHITELISTED: 2
};

function ajax_get(url, cb) {
    var request = new XMLHttpRequest(),
        callback = cb || function() {};
    request.open('GET', url, true);
    request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
            var data;
            try {
                data = JSON.parse(request.responseText);
            } catch (e) {
                data = null;
            }
            return callback(null, data);
        } else {
            callback('ajax_get error');
        }
    };
    request.onerror = function() {
        return callback('ajax_get error');
    };
    request.send();
}

if (typeof NON_ENGLISH_LOCALE === 'undefined') {
    var NON_ENGLISH_LOCALE = false;
}

function getPathInfo(path) {
    //  create a link in the DOM and set its href
    var link = document.createElement('a');
    link.setAttribute('href', path);

    //  return an easy-to-use object that breaks apart the path
    return {
        host: link.hostname, //  'example.com'
        port: link.port, //  12345
        path: link.pathname, //  '/blog/foo/bar'
        protocol: link.protocol //  'http:'
    }
}

function stripQueryParams(url) {
    var urlData = getPathInfo(url);
    var site = urlData.protocol + "//" + urlData.host;
    if (urlData.port) {
        site = site + ":" + urlData.port;
    }
    site = site + urlData.path;
    return site;
}

function isSpecialTab(url) {
    if (url.indexOf('chrome:') === 0 || url.indexOf('chrome-extension:') === 0 || url.indexOf('chrome-devtools:') === 0 || url.indexOf('file:') === 0 || url.indexOf('chrome.google.com/webstore') >= 0) {
        return true;
    }
    return false;
}
// return whether the container is already covered
function alreadyCovered(container) {
    return (container.find(".FAH_adBlockerCover").length > 0);
}

// true if we want to overlay non-ads as well
var showNonAd = false;

function alreadyCoveredSameType(container, newCoverIsAd) {
    var alreadyCovered = (container.find(".kp-modalDialog").length > 0);
    var alreadyAd = (container.find(".CITP_isAnAd").length > 0)
    return alreadyCovered && (alreadyAd || !newCoverIsAd);
}


function coverContainer(container, url, matchingText, deepestOnly, isAd, hasInterval, intervalID, cb) {
    // if we aren't doing anything to non-ads and this isn't an ad, do nothing.
    if (!isAd && !showNonAd) {
        return false;
    }

    var viewportwidth;
    var viewportheight;

    if (typeof window.innerWidth != 'undefined') {
        viewportwidth = window.innerWidth,
        viewportheight = window.innerHeight
    }
    console.log("width", viewportwidth);
    console.log("Height", viewportheight);

    // don't cover if this container is already covered;
    if (alreadyCoveredSameType(container, false)) {
        return false;
    }
    // viewportwidth1 = (viewportwidth / 2) - 250;
    // viewportheight1 = (viewportheight / 2) - 225;
    container.find(".kp-modal-container").remove();

    var imgPath = chrome.extension.getURL("assets/icons/icon128.png");
    const modalTemplate = `
    <div class="kp-modal-container" >
    <div style="position: relative; width: ${viewportwidth}px; height: ${viewportheight}px; overflow: auto;">
     <div class="kp-modalDialog">
        <div class="kp-modal-dialog">
          <div class="kp-modal-content">

            <div class="kp-modal-header">
              <button  type="button" class="kp-close close-killphiser" data-dismiss="modal">&times;</button>
              <div class="kp-logo"><img src="${imgPath}" width="40px"></div>
              <div class="kp-modal-title">
                Are you being phished?
              </div>
            </div>

            <div class="kp-modal-body">
              <span>This looks like <b>  ${url}</b>.</span></br>
              <span>But it isn't!</span>
            </div>


          <div class="kp-modal-footer">
            <!--button type="button" class="kp-btn kp-btn-default" >Report Phishing</button-->
            <button type="button" id = "kp-btn-skip" class="kp-btn kp-btn-default">Add to skiplist</button>
            <button type="button" class="kp-btn kp-btn-default close-killphiser kp-pull-right">Close</button>
            <div class="kp-clr"></div>
          </div>

        </div>
     </div>
     </div>
    </div>
    </div>
  `;

    container.prepend(modalTemplate).fadeIn();
    // make sure the close button closes the cover
    container.find(".close-killphiser").on("click", function() {
        container.children(".kp-modal-container").css("visibility", "hidden");
        container.children().css("opacity", 1);
    });
    container.find("#kp-btn-skip").on("click", function() {
        cb();
        container.children(".kp-modal-container").css("visibility", "hidden");
        container.children().css("opacity", 1);
    });
}

function addProfile() {

}


function assert() {
    var args = [].slice.call(arguments),
        name = 'ASSERT',
        cond, rest;

    if (isstring(args[0])) {
        name = name + ': ' + args[0];
        cond = args[1];
        rest = args.slice(2);
    } else {
        cond = args[0];
        rest = args.slice(1);
    }
    if (!cond) {
        var e = new Error(name);
        console.log(name, rest);
        console.log(e.stack);
        throw e;
    }
}

function debug(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

/* parseUri, MIT license
 * http://blog.stevenlevithan.com/archives/parseuri
 * Copyright 2007, Steven Levithan
 */

function parseUri(str) {
    var parser = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@\/]*)(?::([^:@\/]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,
        parserKeys = ["source", "scheme", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "fragment"],
        m = parser.exec(str || ''),
        parts = {};

    parserKeys.forEach(function(key, i) {
        parts[key] = m[i] || '';
    });
    return parts;
}

function parseqs(str) {
    var qp = str.split('&'),
        params = {};

    qp.forEach(function(el) {
        var pv = el.split('=');
        if (pv.length === 2) {
            params[pv[0]] = pv[1];
        }
    });
    return params;
}

function isnumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function isstring(obj) {
    return obj instanceof String || typeof obj === 'string';
}
