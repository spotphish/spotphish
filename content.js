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

// The perceptual adblocker logic. 28 total lines with comments and empty
// lines removed.

// stores repeated check interval id to allow it to be canceled
var intervalID;

// This response is triggered by the background script.
// If the background script found adchoices, then response.element
// will have a stringified version of the dom element that triggered it.
var handleBkgdResponse = function(response) {
    if (typeof response === 'undefined'){
        return true;
    }
    if ('element' in response) {
        //console.log(response['element']);
        // cover the body, place text "ADCHOICES IDENTIFIED", no local info,
        // not only the deepest container, this is an ad, there is an interval,
        // and the interval's id is intervalID
        coverContainer($('body'), "ADCHOICES IDENTIFIED", "", false, true, true, intervalID);
    }
    else if ('no_element' in response) {
        //console.log('Not adchoices image!');
        // cover the body, place text "NOT ADCHOICES", no local info,
        // not only the deepest container, this is not an ad, there is an
        // interval, and the interval's id is intervalID
        coverContainer($('body'), "NOT ADCHOICES", "", false, false, true, intervalID);
    }
    return true;
};

var inputTypeCheck;
// console.log("Welcome message");
function checkInputBox () {
  inputTypeCheck = document.querySelectorAll("input[type='password']")
  if (inputTypeCheck != "undefined" && inputTypeCheck.length >= 1)
  {
    // console.log("Found password input box");
   return true
  }else{
    // console.log("Not found any input box");
    return false
  }
}

// if we are in an iframe (which contains the vast majority of adchoices ads)
if (checkInputBox()) {
  // console.log("Found check box");
  runImageSearch($('body'), handleBkgdResponse);
}
