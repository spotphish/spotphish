
const DEFAULT_IMG = chrome.extension.getURL("assets/img/secure_img/kp1.jpg");
const whitelist_msg = "Login pages on which you will see your personal secure image.";
const safesite_msg = "Trusted domains which are highly unlikely to host phishing pages. We skip checking pages on these sites as a performance optimization.";
const redflag_msg = "We have snapshots of the login pages of these sites. If any page you browse looks very similar to one of these snapshots, it is flagged as a possible phishing attempt.";
var KPWhiteList,
    KPSkipList,
    KPRedFlagList;

var tab = "whitelist";
console.log(DEFAULT_IMG);

function template(index, data) {
    return '<div class="white-list-row" data-id=' +index + ' >' +
          '<div class="site-name">' +
            data +
          '</div>' +
          '<div class="wl-actions">' +
              //'<div class="wl-active">' +
              //  '<input id="checkbox0" type="checkbox">' +
              //'</div>' +
              //'<div class="wl-edit" data-id=' +index + '>' +
              //    '<span class="glyphicon glyphicon-pencil"></span>' +
              //'</div>' +
              '<div class="wl-delete" data-id=' +index + ' >' +
                  '<span class="glyphicon glyphicon-remove"></span>' +
              '</div>' +
              '<div class="clr"></div>' +
          '</div>' +
        '</div>';
}

function template1(index, data, status) {
    return '<div class="white-list-row" data-id=' +index + ' >' +
          '<div class="site-name">' +
            data +
          '</div>' +
          '<div class="wl-actions">' +
              '<div class="wl-active">' +
                '<input class="wl-checkbox" type="checkbox" '+ status + ' data-id=' + index + ' >' +
              '</div>' +
              '<div class="clr"></div>' +
          '</div>' +
        '</div>';
}
function updateImage(data) {
    var img = document.createElement('img');
    img.id = 'display-img';

    if (data) {
        console.log("Data found");
        img.height = data.height || 200;
        img.width = data.width || 200;
        chrome.storage.local.set({"secure_img": data}, function() {
            console.log("Data Saved : ", data);
            if (data.type === 'suggested' || data.type === 'default') {
                img.src = data.src;
            } else if (data.type === 'custom') {
                //img.src = "data:image/jpeg;base64," + data.src;
                img.src = data.src;
                console.log(img.src);
            }
            //img.height = data.height || 200;
            //img.width = data.width || 200;
            $('.image').empty();
            $('.image').append(img);
        });
        // For Selected Image
    } else {
        chrome.storage.local.get("secure_img", function(result) {
            data = result.secure_img;
            console.log("Type of Data: ", typeof data );
            console.log("Data received : ", data);
            if (typeof data === "undefined") {

                data = {};
                data.type = "default";
                data.src = DEFAULT_IMG;
                updateImage(data);
                //$('.image').append(img);
                //return;
            }
            console.log("Data received : ", data);
            img.src = data.src;
            img.height = data.height || 200;
            img.width = data.width || 200;
            console.log("Image : ", img);
            $('.image').empty();
            $('.image').append(img);
        });
        //Search for image from local storage
        //If no data stored in local storage use default img
    }

}

function updateTableData() {
    chrome.storage.local.get(["whitelist", "skiplist","redflaglist"], function(result) {
        var data = result.whitelist;
            console.log("Data received : ", result );
            if (result.whitelist) {
                KPWhiteList = result.whitelist;
            } else {
                KPWhiteList = whiteListedDomains;
            }
            if (result.skiplist) {
                KPSkipList = result.skiplist;
            } else {
                //KPWhiteList = whiteListedDomains;
            }
            if (result.redflaglist) {
                KPRedFlagList = result.redflaglist;
            } else {
                //KPWhiteList = whiteListedDomains;
            }
            renderTable();
    });
}

function renderTable() {
    $('.white-list-scroll').empty();
    $('.wl-desc p').empty();
    if (tab === "whitelist") {
        $('.wl-desc p').append(whitelist_msg);
        renderWhiteListTable();
    } else if (tab === 'redflag') {
        $('.wl-desc p').append(redflag_msg);
        renderRedFlagTable();
    } else if (tab === 'safedomain') {
        $('.wl-desc p').append(safesite_msg);
        renderSafeDomainTable();
    } 
}

function renderWhiteListTable() {

    var length = KPWhiteList.length;

    for (i = 0; i < length; i++ ) {
        $('.white-list-scroll').append(template(i, KPWhiteList[i]));
    }

    $('.wl-delete').on('click', function(e) {
        e.preventDefault();
        var id = $(this).data("id");
        console.log("Clicked : ", KPWhiteList[id]);
        var res = confirm("Do you want to delete " + KPWhiteList[id] + " from whitelist");
        if (res) {
            $('.white-list-scroll').empty();
            KPWhiteList.splice(id, 1);
            saveWhiteListData()
            renderTable();
        }
    });
}

function renderSafeDomainTable() {
    var length = KPSkipList.length;
    for (i = 0; i < length; i++ ) {
        $('.white-list-scroll').append(template(i, KPSkipList[i]));
    }

    $('.wl-delete').on('click', function(e) {
        e.preventDefault();
        var id = $(this).data("id");
        console.log("Clicked : ", KPSkipList[id]);
        var res = confirm("Do you want to delete " + KPSkipList[id] + " from Safe Domain list");
        if (res) {
            $('.white-list-scroll').empty();
            KPSkipList.splice(id, 1);
            saveSkipListData();
            //saveTableData();
            renderTable();
        }
    });
}

function renderRedFlagTable() {

    var length = KPRedFlagList.length;

    for (i = 0; i < length; i++ ) {
        $('.white-list-scroll').append(template1(i, KPRedFlagList[i].templateName, KPRedFlagList[i].enabled ? "checked" : ""));
    }
    //$('.wl-delete').css("display", "none");

    $('.wl-checkbox').change(function(e) {
        e.preventDefault();
        var id = $(this).data("id");
        console.log("Clicked : ", KPRedFlagList[id]);
        //var res = confirm("Do you want to delete " + KPRedFlagList[id] + " from whitelist");
        var enabled = $(this).is(':checked');
        if (enabled !== KPRedFlagList[id].enabled) {
            $('.white-list-scroll').empty();
            KPRedFlagList[id].enabled = enabled;
            saveRedFlagData()
            renderTable();
        }
    });
}
function saveWhiteListData() {
    chrome.storage.local.set({whitelist : KPWhiteList},() => {
        var bkg = chrome.extension.getBackgroundPage();
        bkg.syncWhiteList();
        console.log("whitelist : ", KPWhiteList )
        });
}

function saveSkipListData() {
    chrome.storage.local.set({skiplist : KPSkipList},() => {
        var bkg = chrome.extension.getBackgroundPage();
    	bkg.syncSkipList();
        console.log("skiplist : ", KPSkipList )
        });
}

function saveRedFlagData() {
    chrome.storage.local.set({ redflaglist : KPRedFlagList},() => {
        var bkg = chrome.extension.getBackgroundPage();
    	bkg.syncRedFlagList();
        console.log("redflaglist : ", KPRedFlagList );
        });
}

function closeImgUploader() {
    $('.img-uploader-container').addClass("hide");
    $('.whitelist-container').removeClass("hide");
}

function addData(val) {
    if (!val || val === "") {
        return;
    }
    if (tab === "whitelist") {
        if(KPWhiteList.indexOf(val) === -1) {
            KPWhiteList.push(val);
            saveWhiteListData();
            renderWhiteListTable();
        }
    } else if (tab === 'safedomain') {
        if(KPSkipList.indexOf(val) === -1) {
            KPSkipList.push(val);
            saveSkipListData();
            renderSafeDomainTable();
        }
    }
}

$(document).ready(function() {
    updateImage();
    updateTableData();
	$('.rig li').on('click', function(event){
		event.preventDefault();
		/*$('.grid-container').fadeOut(500, function(){
			$('#' + gridID).fadeIn(500);
		});*/
		//var gridID = $(this).attr("data-id");
		
		$('.rig li').removeClass("active");
		$(this).addClass("active");
        var data = {};
        data.type = 'suggested';
        var img = $(this).children("img")[0];
        var scaleFactor = Math.min(200/img.width, 200/img.height);
        data.width = scaleFactor * img.width;
        data.height = scaleFactor * img.height;
        data.src = img.src;
        updateImage(data);
        closeImgUploader();

        //$('#display-img')[0].src = $(this).children("img")[0].src;
    });

    $('.img-edit').on('click', function(e) {
        $('.whitelist-container').addClass("hide");
        $('.img-uploader-container').removeClass("hide");
    });
    $('#img-uploader-close').on('click',function(e) {
        closeImgUploader();
    });

    $('#custom-img').change( function(e) {
        var canvas = document.getElementById('canvas-cust');
        console.log("Canvas : ", canvas);
        var ctx = canvas.getContext('2d');
        console.log("File : ", e.target.files);
        var url = URL.createObjectURL(e.target.files[0]);
        console.log("url");
        var img = new Image();
        img.onload = function() {
            console.log("Inside Img");
            var scaleFactor = Math.min(200/img.width, 200/img.height);
            canvas.width = img.width * scaleFactor;
            canvas.height = img.height * scaleFactor;
            ctx.drawImage(img,0,0,canvas.width, canvas.height);
            var data = {};
            data.type = 'custom';
            data.width = canvas.width;
            data.height = canvas.height;
            data.src = canvas.toDataURL('image/jpeg');
            updateImage(data);
        }
        img.src = url;
		$('.rig li').removeClass("active");
        $('#canvas-cust').removeClass("hide");
    });

    $('.wl-tab-item').on('click', function(e) {
        $('.wl-tab-item').removeClass('wl-active-tab');
        $(this).addClass('wl-active-tab');
        tab = $(this).data('list');
        if(tab === "redflag") {
            $('.wl-add-btn').addClass('hide');
        } else {
            $('.wl-add-btn').removeClass('hide');
        }
        renderTable();
        console.log("Tab : ", tab);
    });

    $('.wl-add-btn').on('click', function(e) {
        $('.wl-input-wrapper').removeClass('hide');
    });
    $('.wl-fa-save').on('click', function(e) {
        var val = $('.wl-input').val();
        console.log("Value : ", val);
        //TODO: Save to the appropriate list
        $('.wl-input-wrapper').addClass('hide');
        addData(val);

    });
    $('.wl-fa-cancel').on('click', function(e) {
        $('.wl-input-wrapper').addClass('hide');
    });
});
