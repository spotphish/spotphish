/* ----------------------------------------------------------------------------------
 * Authors: Grant Storey & Dillon Reisman
 * Written: Dec '16
 * Last Updated: 3/7/17
 * Description: Content script that runs in iframes, determines whether they
 * contain an adchoices icon, and if so covers them with a red box that says
 * "Adchoices identified." Can optionally overlay non ads with "Adchoices not identified."
 * as well for testing purposes.
 * Dependencies: jquery, perceptual_background.js, image_search.js, utils.js.
 * ----------------------------------------------------------------------------------
 */

// stores repeated check interval id to allow it to be canceled
var intervalID;

var protocol = window.location.protocol,
    srcDomain = window.location.hostname;
var whitelist = [ "google.com", "facebook1.com", "google.co.in", "twitter.com", "paypal1.com"];
// var whitelist = [ "google1.com", "facebooksss.com", "google11.co.in", "twitter11.com"];

// This response is triggered by the background script.
// If the background script found adchoices, then response.element
// will have a stringified version of the dom element that triggered it.
var handleBkgdResponse = function(response) {

    if (typeof response === 'undefined'){
        return true;
    }
    console.log("response", response);
    if ('template_match' in response) {
        //console.log(response['element']);
        // cover the body, place text "ADCHOICES IDENTIFIED", no local info,
        // not only the deepest container, this is an ad, there is an interval,
        // and the interval's id is intervalID
        console.log("Match found");
      coverContainer($('body'), "NOT A PHISING SITE", "", false, true, true, intervalID);
    }
    else if ('no_match' in response) {
       console.log("Match not found");
        //console.log('Not adchoices image!');
        // cover the body, place text "NOT ADCHOICES", no local info,
        // not only the deepest container, this is not an ad, there is an
        // interval, and the interval's id is intervalID
        // coverContainer($('body'), "NOT A PHISING SITE", "", false, false, true, intervalID);
    }
    return true;
};

var inputTypeCheck;
// console.log("Welcome message");
function checkInputBox() {
    inputTypeCheck = document.querySelectorAll("input[type='password']")
        if (inputTypeCheck && inputTypeCheck.length >= 1) {
            // console.log("Found password input box");
            return true;
        } else {
            // console.log("Not found any password input box");
            return false;
        }
}

function checkWhitelist( hostName) {
    var length = whitelist.length;
    for (var i = 0; i < length; i++ ) {
        if (hostName.endsWith(whitelist[i])) {
            console.log("WHITE LISTED : ", whitelist[i]);
            return true;
        }
    }
    console.log(" NOT WHITE LISTED : ", hostName);
    return false;
}

var isWhitelisted = protocol === "https:" ? checkWhitelist(srcDomain): false;

function start() {
    if ( !isWhitelisted && checkInputBox()) {
        console.log("Calling snapShot");
        chrome.runtime.sendMessage({
            message: 'capture',
            area: {x: 0, y: 0, w: innerWidth, h: innerHeight}, dpr: devicePixelRatio
        }, handleBkgdResponse)
    }
}
// var capture = (force) => {
//     chrome.runtime.sendMessage({
//         message: 'capture',
//         area: {x: 0, y: 0, w: innerWidth, h: innerHeight}, dpr: devicePixelRatio
//     }, (res) => {
//         console.log("the result of capture", res.image);
//         //save(res.image)
//     })

//     // if ( !isWhitelisted && checkInputBox()) {
//     if ( checkInputBox()) {
//       alert("hello");
//       runImageSearch($('body'), handleBkgdResponse);
//     }
// }

var filename = () => {
    var pad = (n) => ((n = n + '') && (n.length >= 2 ? n : '0' + n))
        var timestamp = ((now) =>
                [pad(now.getFullYear()), pad(now.getMonth() + 1), pad(now.getDate())].join('-')
                + ' - ' +
                [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-')
                )(new Date())
        return 'Screenshot Capture - ' + timestamp + '.png'
}

var save = (image) => {
  var link = document.createElement('a')
  link.download = filename()
  link.href = image
  console.log("Image link", link);
  link.click();
}

console.log ("dpr : ", devicePixelRatio);

start();
