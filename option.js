
const DEFAULT_IMG = chrome.extension.getURL("assets/img/secure_img/kp1.jpg");
const whitelist_msg = "Login pages on which you will see your personal secure image.";
const safesite_msg = "Trusted domains which are highly unlikely to host phishing pages. We skip checking pages on these sites as a performance optimization.";
const redflag_msg = "We have snapshots of the login pages of these sites. If any page you browse looks very similar to one of these snapshots, it is flagged as a possible phishing attempt.";
const whitelistTitle = "Manage Whitelist";
const safeSitesTitle = "Manage Safe Sites";
var KPWhiteList,
    KPSkipList,
    KPRedFlagList;

var bkg = chrome.extension.getBackgroundPage();
var tab = "whitelist";
console.log(DEFAULT_IMG);
/*
var cb = function (data) {
    console.log("IDB-Data", data);
}
var bkg = chrome.extension.getBackgroundPage();
bkg.initWhitelist("IDBI", cb);
*/

function templateSkipDomain(index, data) {
    const template = `
<div class="white-list-row" data-id=${index} data-name=${data}>
    <div class="site-name">
    ${data}
    </div>
    <div class="wl-actions">
        <!--div class="wl-active">
        <input id="checkbox0" type="checkbox">
        </div-->
        <div class="wl-delete" data-id=${index}>
            <span class="glyphicon glyphicon-remove"></span>
        </div>
        <div class="clr"></div>
    </div>
</div>`;

    return template;
}

function hello() {
    alert("hello");
}

function template3(data) {
    var name = data.url;
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
<div class="white-list-row" data-id=${data.id} data-name=${data.site}>
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
    var img = document.createElement("img");
    img.id = "display-img";

    if (data) {
        console.log("Data found");
        img.height = data.height || 200;
        img.width = data.width || 200;
        chrome.storage.local.set({"secure_img": data}, function() {
            console.log("Data Saved : ", data);
            if (data.type === "suggested" || data.type === "default") {
                img.src = data.src;
            } else if (data.type === "custom") {
                //img.src = "data:image/jpeg;base64," + data.src;
                img.src = data.src;
                console.log(img.src);
            }
            //img.height = data.height || 200;
            //img.width = data.width || 200;
            $(".image").empty();
            $(".image").append(img);
        });
        // For Selected Image
    } else {
        chrome.storage.local.get("secure_img", function(result) {
            data = result.secure_img;
            if (typeof data === "undefined") {

                data = {};
                data.type = "default";
                data.src = DEFAULT_IMG;
                updateImage(data);
                //$(".image").append(img);
                //return;
            }
            console.log("Data received : ", data);
            img.src = data.src;
            img.height = data.height || 200;
            img.width = data.width || 200;
            console.log("Image : ", img);
            $(".image").empty();
            $(".image").append(img);
        });
        //Search for image from local storage
        //If no data stored in local storage use default img
    }

}

function updateTableData() {
    chrome.storage.local.get(["skiplist","redflaglist"], function(result) {
        console.log("Data received : ", result );
        if (result.skiplist) {
            KPSkipList = result.skiplist;
        } else {
            KPSkipList = skipDomains;
        }
        if (result && result.redflaglist) {
            KPRedFlagList = result.redflaglist;
        } else {
            KPRedFlagList = redFlagSites;
        }
        renderTable();
    });
}

function renderTable() {
    $(".white-list-scroll").empty();
    $(".wl-desc p").empty();
    if (tab === "whitelist") {
        $(".wl-desc p").append(whitelist_msg);
        $(".sub-title p").text(whitelistTitle);
        bkg.syncWhiteList(renderWhiteListTable);
        //renderWhiteListTable();
    } /*else if (tab === "redflag") {
        $(".wl-desc p").append(redflag_msg);
        renderRedFlagTable();
    } */else if (tab === "safedomain") {
        $(".wl-desc p").append(safesite_msg);
        $(".sub-title p").text(safeSitesTitle);
        renderSafeDomainTable();
    }
}

function renderWhiteListTable(data) {

    console.log("IDB-data", data);
    data.forEach((x)=> {
        if (x.url) {
            $(".white-list-scroll").append(template3(x));
        }
    });
    $(".wl-add-btn").addClass("hide");
    $(".white-list-row").on("click", function(e) {
        e.preventDefault();
        var id = $(this).data("id");
        var name = $(this).data("name");
        if ($(e.target).is(".wl-delete-icon")) {
            var res = confirm("Do you want to delete " + name + " from whitelist");
            if (res) {
                $(this).remove();
                bkg.removeFromWhiteListById(id);
            }
        }
        if ($(e.target).is(".op-check")) {
            console.log($(e.target)[0].id);
            if ($(e.target).is(":checked")) {
                bkg.toggleWhitelistItems(id, true, renderTable);
            } else {
                bkg.toggleWhitelistItems(id, false, renderTable);
            }
        }
    });
    $(".op-check").click(function() {
        console.log("onclick called", this.id);
        //var checkBoxes = $("input[nam)
        console.log($(this.id));//.prop("checked"));
        $(this.id).prop("checked", !$(this.id).prop("checked"));
    });  
}

function renderSafeDomainTable() {
    var length = KPSkipList.length;
    for (let i = 0; i < length; i++) {
        $(".white-list-scroll").append(templateSkipDomain(i, KPSkipList[i]));
    }

    $(".wl-delete").on("click", function(e) {
        e.preventDefault();
        var id = $(this).data("id");
        console.log("Clicked : ", KPSkipList[id]);
        var res = confirm("Do you want to delete " + KPSkipList[id] + " from Safe Domain list");
        if (res) {
            $(".white-list-scroll").empty();
            KPSkipList.splice(id, 1);
            saveSkipListData();
            //saveTableData();
            renderTable();
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
    chrome.storage.local.set({skiplist : KPSkipList}, () => {
        var bkg = chrome.extension.getBackgroundPage();
        bkg.syncSkipList();
        console.log("skiplist : ", KPSkipList);
    });
}

function saveRedFlagData() {
    chrome.storage.local.set({ redflaglist : KPRedFlagList}, () => {
        var bkg = chrome.extension.getBackgroundPage();
        bkg.syncRedFlagList();
        console.log("redflaglist : ", KPRedFlagList);
    });
}

function closeImgUploader() {
    $(".img-uploader-container").addClass("hide");
    $(".whitelist-container").removeClass("hide");
}

function addData(val) {
    if (!val || val === "") {
        return;
    }

    if (tab === "safedomain") {
        if (KPSkipList.indexOf(val) === -1) {
            KPSkipList.push(val);
            saveSkipListData();
            renderSafeDomainTable();
        }
        else {
            alert("Value entered already saved as a safe domain");
        }
    }
}

$(document).ready(function() {
    updateImage();
    updateTableData();
    $(".rig li").on("click", function(event) {
        event.preventDefault();
        $(".rig li").removeClass("active");
        $(this).addClass("active");
        var data = {};
        data.type = "suggested";
        var img = $(this).children("img")[0];
        var scaleFactor = Math.min(200 / img.width, 200 / img.height);
        data.width = scaleFactor * img.width;
        data.height = scaleFactor * img.height;
        data.src = img.src;
        updateImage(data);
        closeImgUploader();

        //$("#display-img")[0].src = $(this).children("img")[0].src;
    });

    $(".img-edit").on("click", function(e) {
        $(".whitelist-container").addClass("hide");
        $(".img-uploader-container").removeClass("hide");
    });
    $("#img-uploader-close").on("click", function(e) {
        closeImgUploader();
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
        $(".rig li").removeClass("active");
        $("#canvas-cust").removeClass("hide");
    });

    $(".wl-tab-item").on("click", function(e) {
        $(".wl-tab-item").removeClass("wl-active-tab");
        $(this).addClass("wl-active-tab");
        tab = $(this).data("list");
        if (tab === "whitelist") {
            $(".wl-add-btn").addClass("hide");
        } else {
            $(".wl-add-btn").removeClass("hide");
        }
        renderTable();
        console.log("Tab : ", tab);
    });

    $(".wl-add-btn").on("click", function(e) {
        $(".wl-input-wrapper").removeClass("hide");
    });
    $(".wl-fa-save").on("click", function(e) {
        var input = $(".wl-input").val();
        var val;
        let domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
        let urlPattern = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?/;
        if (domainRegex.test(input)) {
            val = input;
        } else if (urlPattern.test(input)) {
            val = bkg.getPathInfo(input).host;
        }
        else {
            alert("Invalid URL or domain name, please retry with a porper value");
            return;
        }
        console.log("Value : ", input);
        //TODO: Save to the appropriate list
        $(".wl-input").val("");
        $(".wl-input-wrapper").addClass("hide");
        addData(val);

    });
    $(".wl-fa-cancel").on("click", function(e) {
        $(".wl-input-wrapper").addClass("hide");
    });
});
