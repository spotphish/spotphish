/* ----------------------------------------------------------------------------------
 * Authors: Grant Storey & Dillon Reisman
 * Written: 3/5/17
 * Last Updated: 3/7/17
 * Description: Helper code for covering advertisements that have been found.
 * Dependencies: jquery.
 * ----------------------------------------------------------------------------------
 */

// sets logging level
var VERBOSE = false;

const tab_status = {
    NA : 0,
    WHITELISTED : 1,
    NOT_WHITELISTED : 2
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
        host:     link.hostname,  //  'example.com'
        port:     link.port,      //  12345
        path:     link.pathname,  //  '/blog/foo/bar'
        protocol: link.protocol   //  'http:'
    }
}

function stripQueryParams(url) {
    var urlData = getPathInfo(url);
    var site = urlData.protocol +"//" + urlData.host;
    if (urlData.port) {
        site = site + ":" + urlData.port;
    }
    site = site + urlData.path;
    return site;
}

function isSpecialTab(url) {
    if (url.indexOf('chrome:') === 0
        || url.indexOf('chrome-devtools:') === 0
        || url.indexOf('file:') === 0
        || url.indexOf('chrome.google.com/webstore') >= 0) {
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

// return whether the container is already covered by the same type
// of container. That is, if there is already an ad or non-ad container
// we don't want to ad a container of a new type, but if an adchoices
// icon has been added and it changed from non-ad to ad, we do want
// to update.
function alreadyCoveredSameType(container, newCoverIsAd) {
  var alreadyCovered = (container.find(".kp-modalDialog").length > 0);
  var alreadyAd = (container.find(".CITP_isAnAd").length > 0)
  return alreadyCovered && (alreadyAd || !newCoverIsAd);
}

// Add a cover with "THIS IS AN AD" and the "Sponsored" text in the given
// locale's language (if non-english).
// container is the container to cover.
// coverText is the text to show on the cover
// matchingText only has a value if we are on Facebook in a non-english locale.
// deepestOnly is true if we only want to include the deepest cover for this
// area.
// isAd is true if it is an ad
// hasInterval is true if there is an interval check associated with this cover
// intervalID is the id of that interval
function coverContainer(container, url, matchingText, deepestOnly, isAd, hasInterval, intervalID) {
    // if we aren't doing anything to non-ads and this isn't an ad, do nothing.
    if (!isAd && !showNonAd) {
      return false;
    }


  var viewportwidth;
   var viewportheight;

   if (typeof window.innerWidth != 'undefined')
   {
        viewportwidth = window.innerWidth,
        viewportheight = window.innerHeight
   }
   console.log("width", viewportwidth);
   console.log("Height", viewportheight);

  // don't cover if this container is already covered;
  if (alreadyCoveredSameType(container, false)) {
    return false;
  }
  viewportwidth   = (viewportwidth / 2) - 250;
  viewportheight  = (viewportheight / 2)  - 225;

  // remove any existing covers (if we are moving from non-ad to ad)
  container.find(".kp-modalDialog").remove();

  var prepend = "<div class=\"kp-modalDialog \" style=\"top:" + viewportheight + "px; left:" + viewportwidth  + "px;\">";
  prepend += "<div class=\"kp-modal-dialog\">";
  prepend += "<div class=\"kp-modal-content\">";

  prepend += "<div class=\"kp-modal-header\">";
  prepend += "<button  type=\"button\" class=\"kp-close close-killphiser\" data-dismiss=\"modal\">&times;</button>";
  prepend += "<h4 class=\"kp-modal-title\">Are you being phished?</h4>";
  prepend += "</div>";

  prepend += "<div class=\"kp-modal-body\">";
  prepend += "<span>This looks like <b>" +  url  + "</b>.</span></br>";
  prepend += "<span>But it isn't!</span>";
  prepend += "</div>";
  prepend += "<div class=\"kp-modal-footer\">";
  prepend += "<button type=\"button\" class=\"kp-btn kp-btn-default\" >Report Phishing</button>";
  prepend += "<button type=\"button\" class=\"kp-btn kp-btn-default\">Report false alarm</button>";
  prepend += "<button type=\"button\" class=\"kp-btn kp-btn-default close-killphiser kp-pull-right\">Close</button>";
  prepend += "<div class=\"kp-clr\"></div>";
  prepend += "</div>";

  prepend += "</div>";
  prepend += "</div>";
  prepend += "</div";

  // prepend += "</div>";
  var myPrepend = prepend;

  // if we only want the deepest, remove any above this
  /*if (deepestOnly) {
    container.parents().each(function (index) {
      $(this).children(".FAH_adBlockerCover").remove();
    });
  }*/
  // if we only want the deepest covers and there is a cover within
  // this container already, don't ad this cover.
  // if (!(container.find(".modalDialog").length > 0)) {
    // prepend the cover
    container.css("position", "relative");
    container.prepend(myPrepend).fadeIn();
    container.children().not('.kp-modalDialog').css("opacity", 0.3);
    // make sure the close button closes the cover
    container.find(".close-killphiser").on("click", function () {
      container.children(".kp-modalDialog").css("visibility", "hidden");
      container.children().css("opacity", 1);
    });
  // }


  // if this is an ad and we have an interval, stop the search for ads.
  if (hasInterval && isAd) {
    clearInterval(intervalID);
  }
}

function addProfile(){

}
/******************************************************
***** Demo of link clicking by x/y coordinate. This will work on a logged-in
***** facebook.com page.
***** The code clicks on the user's profile in the top bar.
*/
/*
setTimeout(function() {

    simulateClickByPoint(502,21);

}, 5000);
*/

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

