
    console.log("Start");
const DEFAULT_IMG = "assets/img/secure_img/kp1.jpg";
var KPWhiteList;
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
function updateImage(data) {
    var img = document.createElement('img');
    img.id = 'display-img';

    if (data) {
        console.log("Data found");
        img.height = data.height;
        img.width = data.width;
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
            var data = result.secure_img;
                console.log("Data received : ", typeof data );
            if (data === undefined) {
                data = {};
                data.type = "default";
                data.src = DEFAULT_IMG;
                updateImage(data);
                return;
            }
            console.log("Data received : ", data);
            img.src = data.src;
            img.height = data.height || 200;
            img.width = data.width || 200;
            $('.image').empty();
            $('.image').append(img);
        });
        //Search for image from local storage
        //If no data stored in local storage use default img
    }

}

function updateTableData() {
    chrome.storage.local.get("whitelist", function(result) {
        var data = result.whitelist;
            console.log("Data received : ", data );
            if (data) {
                KPWhiteList = data;
            } else {
                KPWhiteList = whiteListedDomains;
            }
            renderTable();
    });
}

function renderTable() {

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
            saveTableData();
            renderTable();
        }
    });
}

function saveTableData() {
    chrome.storage.local.set({whitelist : KPWhiteList},() => {
        var bkg = chrome.extension.getBackgroundPage();
    	bkg.syncWhiteList();
        console.log("whitelist : ", KPWhiteList )
        });
}

function closeImgUploader() {
    $('.img-uploader-container').addClass("hide");
    $('.whitelist-container').removeClass("hide");
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
});
