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
    srcDomain = window.location.hostname,
    href = window.location.href,
    skipList;

chrome.storage.local.get(["skiplist"], function(result) {
    var skipListData = result.skiplist;
    if (skipListData) {
        skipList = skipListData;
    } else {
        skipList = skipDomains;
    }
    start();
});



// var whitelist = [ "google1.com", "facebooksss.com", "google11.co.in", "twitter11.com"];

// This response is triggered by the background script.
// If the background script found adchoices, then response.element
// will have a stringified version of the dom element that triggered it.
var t1;
var handleBkgdResponse = function(response) {

    t2 = performance.now();
    console.log("Total turnaround time : " + (t2 - t1) + " ms"); 
    if (typeof response === 'undefined'){
        return true;
    }
    console.log("response", response);
    if ('template_match' in response) {
        //console.log(response['element']);
        // cover the body, place text "ADCHOICES IDENTIFIED", no local info,
        // not only the deepest container, this is an ad, there is an interval,
        // and the interval's id is intervalID
        // console.log("Match found");
      coverContainer($('body'), response.site, "", false, true, true, intervalID);
    }
    else if ('no_match' in response) {
       // console.log("Match not found");
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
/*
function checkWhitelist(url) {
    var length = whList.length;
    var site = stripQueryParams(url);
    for (var i = 0; i < length; i++ ) {
        if (site === whList[i]) {
            console.log("WHITE LISTED : ", whList[i]);
            return true;
        }
    }
    console.log(" NOT WHITE LISTED : ", site);
    return false;
}
*/
function checkSkiplist( hostName) {
    var length = skipList.length;
    for (var i = 0; i < length; i++ ) {
        if (hostName.endsWith(skipList[i])) {
            console.log("SKIP LISTED : ", skipList[i]);
            return true;
        }
    }
    console.log(" NOT SKIP LISTED : ", hostName);
    return false;
}


function start() {
    var bInputBox = checkInputBox();
    if (!bInputBox) {
        console.log("No pwd field");
        return;
    }
    var isSkiplisted = protocol === "https:" ? checkSkiplist(srcDomain): false;
    chrome.runtime.sendMessage({message: "wl_check", url:stripQueryParams(href)}, function(res){
        if (res && res.whitelist) {
            appendSecureImg();
            return;
        }

        window.setTimeout(function() {
            if ( !isSkiplisted && bInputBox) {
                t1 = performance.now();
                console.log("Calling snapShot at T1 : " + t1);
                chrome.runtime.sendMessage({
                    message: 'capture',
                    area: {x: 0, y: 0, w: innerWidth, h: innerHeight}, dpr: devicePixelRatio
                }, handleBkgdResponse);
            }
        }, 2000);
    });
}

//Used for saving screenshot as a file
//Not needed as of now.
/*
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
*/

function appendSecureImg() {
    var prepend = "<div class=\"kp-img-container\">";
    prepend += "<div class=\"FAH_closeButton kp-img-close\">";
    prepend += "<strong> X </strong>";
    prepend += "</div>";
    prepend += "</div>";
    var myPrepend = prepend;
    $('body').prepend(myPrepend);
    chrome.storage.local.get("secure_img", function(result) {
        var data = result.secure_img;
            console.log("Data received : ", data );
        if (data === undefined) {
            data = {};
            data.type = "default";
            data.src = DEFAULT_IMG;
            updateImage(data);
            return;
        }
        var img = document.createElement('img');
        img.height = data.height || 200;
        img.width = data.width || 200;
        img.id = 'kp-secure-img';
        img.src = data.src;
        //$('.image').empty();
        $('.kp-img-container').append(img);

        $('.kp-img-close').on('click', function(e) {
            e.preventDefault();
            $('.kp-img-container').css('display','none');

        });
    });
        //Search for image from local storage
        //If no data stored in local storage use default img

}

var jcrop, selection
var overlay = ((active) => (state) => {
  active = (typeof state === 'boolean') ? state : (state === null) ? active : !active
  $('.jcrop-holder')[active ? 'show' : 'hide']()
  //chrome.runtime.sendMessage({message: 'active', active})
})(false)

var image = (done) => {
  var image = new Image()
  image.id = 'fake-image'
  image.src = chrome.runtime.getURL('/assets/img/pixel.png')
  image.onload = () => {
    $('body').append(image)
    done()
  }
}

var init = (done) => {
    console.log("Inside init");
  $('#fake-image').Jcrop({
    bgColor: 'none',
    onSelect: (e) => {
      console.log("Jcrop fakeimg");
      selection = e
      capture()
    },
    onChange: (e) => {
      selection = e
    },
    onRelease: (e) => {
      setTimeout(() => {
        selection = null
      }, 100)
    }
  }, function ready () {
    console.log("jcrop initialized");
    jcrop = this

    $('.jcrop-hline, .jcrop-vline').css({
      backgroundImage: 'url(' + chrome.runtime.getURL('/assets/img/Jcrop.gif') + ')'
    })

    if (selection) {
      jcrop.setSelect([
        selection.x, selection.y,
        selection.x2, selection.y2
      ])
    }

    done && done()
  })
}

var capture = (force) => {
    if (selection) {
      jcrop.release()
      setTimeout(() => {
        chrome.runtime.sendMessage({
            message: 'crop_capture', area: selection, dpr: devicePixelRatio
        }, (res) => {
          overlay(false)
          selection = null;
          console.log(res);
          //save(res.image)
        })
      }, 50)
    }
}

var filename = () => {
  var pad = (n) => ((n = n + '') && (n.length >= 2 ? n : '0' + n))
  var timestamp = ((now) =>
    [pad(now.getFullYear()), pad(now.getMonth() + 1), pad(now.getDate())].join('-')
    + ' - ' +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-')
  )(new Date())
  return 'KP-' + timestamp + '.png'
}

var save = (image) => {
  var link = document.createElement('a')
  link.download = filename()
  link.href = image
  link.click()
}
/*
window.addEventListener('resize', ((timeout) => () => {
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    jcrop.destroy()
    init(() => overlay(null))
  }, 100)
})())
*/
chrome.runtime.onMessage.addListener((req, sender, res) => {
    if (req.message === 'init') {
        //res({}) // prevent re-injecting
        console.log("Message received");
        var isTemplate = confirm("Do you want to upload a template?");
        if (isTemplate) {
            if (!jcrop) {
                image(() => init(() => {
                    overlay();
                    capture();
                }));
            } else {
                overlay();
                capture(true);
            }
        } else {
            chrome.runtime.sendMessage({
                message: 'add_wh', url: req.url});
      }
  }
  return true
})

function injectConfirmBox(text) {
    var append = '<div class="kp-popup kp-is-visible" role="alert">' +
                '<div class="kp-popup-container">' +
                '<p>' + text + '</p>' +
                '<div class="kp-buttons">' +
                '<div><a href="#0" class="kp-yes">Yes</a></div>' +
                '<div><a href="#0" class="kp-no">No</a></div>' +
                '</div>' +
                '<div="#0" class="kp-popup-close">X<div>'+
                '</div>' +
                '</div>';
    $('body').append(append);
	$('.kp-popup').on('click', function(event){
		if( $(event.target).is('.kp-popup-close') || $(event.target).is('.kp-popup') ) {
			event.preventDefault();
			$(this).removeClass('kp-is-visible');
		}
	});
	//close popup when clicking the esc keyboard button
	$(document).keyup(function(event){
    	if(event.which=='27'){
    		$('.kp-popup').removeClass('kp-is-visible');
	    }
    });
}
