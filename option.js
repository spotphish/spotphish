const whitelist_msg = "Login pages on which you will see your personal secure image.";
const redflag_msg = "We have snapshots of the login pages of these sites. If any page you browse looks very similar to one of these snapshots, it is flagged as a possible phishing attempt.";
const whitelistTitle = "Manage Whitelist";
const advancedSettingsTitle = "Advanced settings";
const safeSitesTitle = "Manage Safe Site";
const defaultImages = ["kp1.jpg", "kp2.jpg", "kp3.jpg", "kp4.jpg", "kp5.jpg", "kp6.jpg", "kp7.jpg"];
var KPWhiteList,
    KPSkipList,
    KPRedFlagList;

var bkg = chrome.extension.getBackgroundPage();
var tab = "whitelist";

function templateImage(src, favorite) {
    const temp = `
    <div class="mdl-cell mdl-cell--4-col mdl-card set-image">
      <div class="mdl-card__media ">
          <img class="secure-image" src="${src}" border="0" alt="">
      </div>
      <div class="mdl-card__menu">
          <button class="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect mdl-button--accent">
            <i class="material-icons kp-active-icons">${favorite}</i>
          </button>
      </div>
    </div>
  `;
    return temp;
}

function templateSafeDomain(index, data) {
    const template = `
        <li class="mdl-list__item kp-safelist-row" data-id=${index} data-name=${data}>
            <span class="mdl-list__item-primary-content">
                <i class="material-icons  mdl-list__item-avatar">public</i>
                ${data}
            </span>
            <a class="mdl-list__item-secondary-action" href="#"><i class="material-icons kp-sl-delete">delete</i></a>
        </li>
        `;
    return template;
}

function template3(data) {
    var name = data.url[0];
    var logo = "";
    var inc = Math.random();
    var checkbox = `<input class="op-check" id=${inc} name=${inc}  type="checkbox">`;
    if (data.logo) {
        logo = `<img src="${data.logo}"></img>`;
    }
    if (data.enabled) {
        checkbox = `<input class="op-check" name=${inc} id=${inc} type="checkbox" checked>`;
    }
    var template = `
<div class="white-list-row" data-id=${data.id} data-name=${data.site} data-url=${data.url[0]} >
    <div class="site-name">
        ${name}
    </div>
    ${logo}
    <div class="wl-actions">
        <div class="wl-active">
            ${checkbox}
        </div>
        <div class="wl-delete">
            <span class="glyphicon glyphicon-remove wl-delete-icon"></span>
        </div>
        <div class="clr"></div>
    </div>
</div>`;
    return template;
}

function updateImage(data) {

    if (data) {
        chrome.storage.local.set({ "secure_img": data }, function() {
            console.log("Data Saved : ", data);
            $("#secureimage").attr("src", data.src);
        });
        // For Selected Image
    } else {
        chrome.storage.local.get("secure_img", function(result) {
            data = result.secure_img;
            $("#secureimage").attr("src", data.src);
        });
        //Search for image from local storage
        //If no data stored in local storage use default img
    }

}

function updateTableData() {
    chrome.storage.local.get(["skiplist"], function(result) {
        console.log("Data received : ", result);
        if (result.skiplist) {
            KPSkipList = result.skiplist;
        } else {
            KPSkipList = skipDomains;
        }
        //renderSafeDomainTable();
        //renderTable();
    });
}

function renderTable() {
    $(".white-list-scroll").empty();
    $(".wl-desc p").empty();
    $("#restore").hide();
    if (tab === "whitelist") {
        $(".wl-desc p").append(whitelist_msg);
        $(".sub-title p").text(whitelistTitle);
        bkg.syncWhiteList(renderWhiteListTable);
        //renderWhiteListTable();
    } else if (tab === "advanced-settings") {
        $("#restore").show();
        $(".sub-title p").text(advancedSettingsTitle);
    }
}

function renderWhiteListTable(data) {

    console.log("IDB-data", data);
    data.forEach((x) => {
        if (x.url) {
            $(".white-list-scroll").append(template3(x));
        }
    });
    $(".wl-add-btn").addClass("hide");
    $(".white-list-row").on("click", function(e) {
        //e.preventDefault();
        var id = $(this).data("id");
        var name = $(this).data("name");
        var url = $(this).data("url");
        console.log(name);
        if ($(e.target).is(".wl-delete-icon")) {
            var res = confirm("Do you want to delete " + name + " from whitelist");
            if (res) {
                $(this).remove();
                bkg.removeFromWhiteList(url, null);
            }
        }
        if ($(e.target).is(".op-check")) {
            console.log($(e.target)[0].id);
            if ($(e.target).is(":checked")) {
                bkg.toggleWhitelistItems(id, true);
            } else {
                bkg.toggleWhitelistItems(id, false);
            }
        }
    });
}

function renderSafeDomainTable() {
    $(".kp-safelist").empty();
    // var length = KPSkipList.length;

    KPSkipList.forEach((data, index)=> {
        $(".kp-safelist").append(templateSafeDomain(index, data));
    });

    $(".kp-safelist-row").on("click", function(e) {
        console.log("clicked");
        //e.preventDefault();
        if ($(e.target).is(".kp-sl-delete")) {
            console.log("clicked1");
            var domain = $(this).data("name");
            var id = KPSkipList.indexOf(domain) ;
            console.log("Clicked : ", KPSkipList[id]);
            var res = confirm("Do you want to delete " + KPSkipList[id] + " from Safe Domain list");
            if (res) {
                KPSkipList.splice(id, 1);
                saveSkipListData();
                $(this).remove();
                //renderSafeDomainTable();
            }
        }
    });
}
/*
function renderRedFlagTable() {

    var length = KPRedFlagList.length;

    for (i = 0; i < length; i++) {
        $(".white-list-scroll").append(template1(i, KPRedFlagList[i].templateName, KPRedFlagList[i].enabled ? "checked" : ""));
    }
    //$(".wl-delete").css("display", "none");

    $(".wl-checkbox").change(function(e) {
        e.preventDefault();
        var id = $(this).data("id");
        console.log("Clicked : ", KPRedFlagList[id]);
        //var res = confirm("Do you want to delete " + KPRedFlagList[id] + " from whitelist");
        var enabled = $(this).is(":checked");
        if (enabled !== KPRedFlagList[id].enabled) {
            $(".white-list-scroll").empty();
            KPRedFlagList[id].enabled = enabled;
            saveRedFlagData();
            renderTable();
        }
    });
}*/

function saveSkipListData() {
    chrome.storage.local.set({ skiplist: KPSkipList }, () => {
        var bkg = chrome.extension.getBackgroundPage();
        bkg.syncSkipList();
        //console.log("skiplist : ", KPSkipList);
    });
}

function saveRedFlagData() {
    chrome.storage.local.set({ redflaglist: KPRedFlagList }, () => {
        var bkg = chrome.extension.getBackgroundPage();
        bkg.syncRedFlagList();
        console.log("redflaglist : ", KPRedFlagList);
    });
}

function closeImgUploader() {
    $(".img-uploader-container").addClass("hide");
    $(".whitelist-container").removeClass("hide");
}

function addToSafeList(val) {
    if (!val || val === "") {
        return;
    }
    if (KPSkipList.indexOf(val) === -1) {
        KPSkipList.push(val);
        saveSkipListData();
        renderSafeDomainTable();
    }
    else {
        alert("Value entered already saved as a safe domain");
    }
}

$(document).ready(function() {
    updateImage();
    updateTableData();

    defaultImages.forEach(function(img) {
        let imagePath = "assets/img/secure_img/" + img;
        $("#imagegallery .mdl-cell:last").before(templateImage(imagePath, "favorite_border"));
    });

    //}
    $(".set-image").on("click", function(event) {
        event.preventDefault();
        // $(".rig li").removeClass("active");
        // $(this).addClass("active");
        var data = {};
        data.type = "suggested";
        var img = $(this).find("img")[0];
        var scaleFactor = Math.min(200 / img.width, 200 / img.height);
        data.width = scaleFactor * img.width;
        data.height = scaleFactor * img.height;
        data.src = img.src;
        updateImage(data);

        $(".kp-active-icons").text("favorite_border");
        var icon = $(this).find("i")[0];
        $(icon).text("favorite");
        // closeImgUploader();
        //$("#display-img")[0].src = $(this).children("img")[0].src;
    });

    $(".img-edit").on("click", function(e) {
        $(".whitelist-container").addClass("hide");
        $(".img-uploader-container").removeClass("hide");
    });

    $("#img-uploader-close").on("click", function(e) {
        closeImgUploader();
    });

    $("#imageUpload").on("click", function(e) {
        $("#custom-img").click();
    });

    $("#custom-img").change(function(e) {
        var canvas = document.getElementById("canvas-cust");
        console.log("Canvas : ", canvas);
        var ctx = canvas.getContext("2d");
        console.log("File : ", e.target.files);
        var url = URL.createObjectURL(e.target.files[0]);
        console.log("url");
        var img = new Image();
        img.onload = function() {
            console.log("Inside Img");
            var scaleFactor = Math.min(200 / img.width, 200 / img.height);
            canvas.width = img.width * scaleFactor;
            canvas.height = img.height * scaleFactor;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            var data = {};
            data.type = "custom";
            data.width = canvas.width;
            data.height = canvas.height;
            data.src = canvas.toDataURL("image/jpeg");
            updateImage(data);
        };
        img.src = url;
        $(".kp-active-icons").text("favorite_border");
        $("#imagegallery .mdl-cell:last").before(templateImage(url, "favorite"));

        $(".set-image").on("click", function(event) {
            event.preventDefault();
            // $(".rig li").removeClass("active");
            // $(this).addClass("active");
            var data = {};
            data.type = "suggested";
            var img = $(this).find("img")[0];
            var scaleFactor = Math.min(200 / img.width, 200 / img.height);
            data.width = scaleFactor * img.width;
            data.height = scaleFactor * img.height;
            data.src = img.src;
            updateImage(data);

            $(".kp-active-icons").text("favorite_border");
            var icon = $(this).find("i")[0];
            $(icon).text("favorite");
            // closeImgUploader();
            //$("#display-img")[0].src = $(this).children("img")[0].src;
        });

    });

    $("#restore").on("click", function(e) {
        if (confirm("This will delete all the templates added by you, Are you sure you want to proceed")) {
            bkg.cleanDB();
            setTimeout(updateTableData, 500);
            updateImage();
        }
    });

    $("#about").on("click", function(e) {
        chrome.tabs.create({
            url: "https://github.com/coriolis/killphisher/blob/master/doc/rationale.md"
        });
    });

    $(".kp-safelist-add-btn").on("click", function(e) {
        var input = $("#kp-safelist-input").val().trim();
        var val;
        if (input.length > 0) {
            let urlPattern = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?/;
            if (urlPattern.test(input)) {
                val = bkg.getPathInfo(input).host;
            }
            else {
                val = input;
            }
            console.log("Value : ", input);
            //TODO: Save to the appropriate list
            addToSafeList(val);
        }
        $("#kp-safelist-input").val("");

    });
    $(".mdl-layout__tab").on("click", function(e){
        console.log("Tab", $(this).attr("href"));
        let href = $(this).attr("href");
        if (href === "#scroll-tab-safedomain") {
            renderSafeDomainTable();
        }
    });
    $(".wl-fa-cancel").on("click", function(e) {
        $(".wl-input-wrapper").addClass("hide");
    });
});
