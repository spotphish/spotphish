const defaultImages = ["kp1.jpg", "kp2.jpg", "kp3.jpg", "kp4.jpg", "kp5.jpg", "kp6.jpg", "kp7.jpg"];
var KPWhiteList,
    KPRedFlagList;
var bkg = chrome.extension.getBackgroundPage();

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

function templateWhitelist(data) {

    let logos_temp = data.templates.filter((x) => {
        return x.logo !== undefined;
    }).reduce((a,b) => {
        var logo_name = "";
        if (b.templateName) {
            logo_name = b.templateName;
        }
        var tmp = `
                    <div class="mdl-cell mdl-cell--6-col mdl-card kp-template-card">
                        <div class="mdl-card__media">
                            <img class="template-image" src="${b.logo}" border="0" alt="">
                        </div>
                        <div class="mdl-card__supporting-text">
                        ${logo_name}
                        </div>
                    </div>`;
        return a + tmp;
    }, "");

    let urls = "";

    if (data.url.length === 1) {
        urls =`
                <tr>
                  <td class="mdl-data-table__cell--non-numeric kp-login-url">${data.url[0]}</td>
                </tr>`;
    } else {
        urls = data.url.reduce((a,b) => {
            var tmp = `
                <tr>
                    <td class="mdl-data-table__cell--non-numeric kp-login-url">${b}</td>
                    <td><i class="material-icons">delete</i></td>
                </tr>`;
            return a + tmp;
        },"");
    }

    const template = `
            <div class="mdl-cell mdl-cell--6-col mdl-card mdl-shadow--4dp">
                <div class="mdl-card__title mdl-card--border">
                    <h2 class="mdl-card__title-text">${data.site}</h2>
                </div>
                <div class="mdl-card__menu">
                    <button class="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect">
                      <i class="material-icons">check_box</i>
                    </button>
                    <button class="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect">
                      <i class="material-icons">delete</i>
                    </button>
                 </div>
                <div class="mdl-grid kp-template-container">
                ${logos_temp}
                </div>
                <div class="mdl-grid">
                    <div class="mdl-cell mdl-cell--12-col kp-url-table-container">
                        <table class="mdl-data-table mdl-js-data-table kp-url-table">
                            <tbody>
                            ${urls}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
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

function renderWhitelistTable(data) {

    console.log("IDB-data", data);
    data.forEach((x) => {
        if (x.url) {
            $(".kp-wl-main").append(templateWhitelist(x));
            //$(".white-list-scroll").append(template3(x));
        }
    });
    /*
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
    */
}


function renderSafeDomainTable() {
    $(".kp-safelist").empty();
    let KPSkipList = bkg.getKPSkipListSites();

    KPSkipList.forEach((data, index)=> {
        $(".kp-safelist").append(templateSafeDomain(index, data));
    });

    $(".kp-safelist-row").on("click", function(e) {
        //e.preventDefault();
        if ($(e.target).is(".kp-sl-delete")) {
            var id = $(this).data("id");
            var domain = $(this).data("name");
            var res = confirm("Do you want to delete " + KPSkipList[id] + " from Safe Domain list");
            if (res) {
                let err = bkg.removeFromKPSkipList(domain);
                if (err) {
                    alert(err);
                } else {
                    $(this).remove();
                }
            }
        }
    });
}

$(document).ready(function() {
    updateImage();
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
    });

    $(".img-edit").on("click", function(e) {
        $(".whitelist-container").addClass("hide");
        $(".img-uploader-container").removeClass("hide");
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
        });

    });

    $("#restore").on("click", function(e) {
        if (confirm("This will delete all the templates added by you, Are you sure you want to proceed")) {
            bkg.cleanDB();
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
            let err = bkg.addToKPSkipList(val);
            if (err) {
                alert(err);
            } else {
                renderSafeDomainTable();
            }
        }
        $("#kp-safelist-input").val("");

    });
    $(".mdl-layout__tab").on("click", function(e){
        console.log("Tab", $(this).attr("href"));
        let href = $(this).attr("href");
        if (href === "#scroll-tab-safedomain") {
            renderSafeDomainTable();
        } else if (href === "#scroll-tab-whitelist") {
            bkg.syncWhiteList(renderWhitelistTable);
        }
    });

    bkg.syncWhiteList((data)=> {
        console.log("Whitelist Data : ", data);
        templateWhitelist(data[0]);
    });
});
