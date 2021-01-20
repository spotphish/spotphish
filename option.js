/*
 * Copyright (C) 2017 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file LICENSE for license details.
 */

const defaultImages = ["kp1.gif", "kp2.jpg", "kp3.jpg", "kp4.jpg"];
var bkg = chrome.extension.getBackgroundPage();
var ProtectedSitesData;
var template_of_MLmodel={
    name:"",
            src:"",
            label:"",
            dependencies:[],
            selected:false,
            weightage:0,
            webgl:false

};
var ROOT_DIR=bkg.getRootDir();

function templateImage(src, favorite, imageClass) {
    const temp = `
    <div class="mdl-cell mdl-cell--4-col mdl-card set-image ${imageClass === undefined ? "" :  imageClass }">
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

function templateSafeDomain(data) {
    const template = `
        <li class="mdl-list__item kp-safelist-row" data-name=${data.domain} >
            <span class="mdl-list__item-primary-content">
                <i class="material-icons  mdl-list__item-avatar">public</i>
                ${data.domain}
            </span>
            <button class="mdl-button mdl-button-icon mdl-js-button mdl-js-ripple-effect mdl-button--colored" ${data.protected? "disabled" :""}>
            <i class="material-icons ${data.protected? "" : "kp-sl-delete"}">delete</i>
            </button>

        </li>
        `;
    return template;
}

//   <a class="mdl-list__item-secondary-action" href="#"><i class="material-icons kp-sl-delete">delete</i></a>
function templateWhitelist(data) {
    const checked = "check_box", unchecked ="check_box_outline_blank";
    let template_str = "";
    if (data.templates) {

        template_str = data.templates.filter(x=>!x.deleted ).reduce((a,b) => {
            var logo_name = "";
            if (b.name) {
                logo_name = b.name;
            }
            var tmp = `
                <div class="mdl-cell mdl-cell--6-col mdl-card kp-template-card">
                    <div class="mdl-card__media">
                        <img class="template-image" src="${b.image}" border="0" alt="">
                    </div>
                    <div class="mdl-card__supporting-text">
                    ${logo_name}
                    </div>
                </div>`;
            return a + tmp;
        }, "");
    }
    let protected_urls = "";
    let enabled = data.disabled ? unchecked : checked;
    let disable_flag = data.disabled ?  "disabled" : "";
    if (data.protected) {
        let protectedList = data.protected.filter(x => !x.deleted);
        protected_urls = protectedList.reduce((a,b) => {
            let url_disabled = b.disabled? unchecked : checked;
            var tmp = `
                <tr class="kp-wl-url-row" data-name=${data.name} data-url=${b.url} >
                    <td class="mdl-data-table__cell--non-numeric kp-login-url">${b.url}</td>
                    <td>
                        <button class="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect mdl-button--colored kp-wl-url-check" ${disable_flag}>
                          <i class="material-icons kp-wl-url-check ${data.disabled? "" : "enable"}">${url_disabled}</i>
                        </button>
                    </td>
                    <td>
                        <button class="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect mdl-button--colored kp-wl-url-delete" ${disable_flag}>
                            <i class="material-icons kp-wl-url-delete ${data.disabled? "" : "enable"}">delete</i>
                        </button>
                    </td>
                </tr>`;
            return a + tmp;
        },"");
    }
    const site = `
            <div class="mdl-cell mdl-cell--6-col mdl-card mdl-shadow--4dp kp-wl-site" data-name=${data.name} >
                <div class="mdl-card__title mdl-card--border">
                    <h2 class="mdl-card__title-text">${data.name}</h2>
                </div>
                <div class="mdl-card__menu">
                    <button class="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect mdl-button--colored kp-wl-site-check">
                      <i class="material-icons kp-wl-site-check">${enabled}</i>
                    </button>
                    <button class="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect mdl-button--colored kp-wl-site-delete">
                      <i class="material-icons kp-wl-site-delete">delete</i>
                    </button>
                 </div>
                <div class="mdl-grid kp-template-container">
                ${template_str}
                </div>
                <div class="mdl-cell mdl-cell--12-col kp-url-table-container">
                    <table class="mdl-data-table mdl-js-data-table kp-url-table">
                        <tbody>
                        ${protected_urls}
                        </tbody>
                    </table>
                </div>
            </div>
            `;
   return site;

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
            if (data.type === "custom"){
                $("#imagegallery #customimage").attr("src", data.src);
                $("#imagegallery #kp-custom-icons").text("favorite");
                $("#imageUpload").text("Change Image");
            } else if (data.type === "suggested" || data.type === "default" ){
                let p = "img[src$='" + data.src.split("assets/")[1] + "']:last";
                $(p).closest(".set-image").find(".kp-active-icons").text("favorite");
            }
        });
    }
}

async function renderProtectedList() {
  return new Promise(function(resolve,reject){

    let data;
     if(ProtectedSitesData==undefined){
          data = bkg.getProtectedSitesData();
         ProtectedSitesData=data;

     }else{
         data=ProtectedSitesData;
     }
         //console.log("Protected-data", data);
         $(".kp-wl-site").remove();
         for(let x of data){
             $(".kp-wl-main").append(templateWhitelist(x));
         }
         $(".kp-wl-site").on("click", function(e) {
             var name = $(this).data("name");
             if ($(e.target).is(".kp-wl-site-delete")) {
                 var res = confirm("Do you want to delete " + name + " from the list of protected pages?");
                 if (res) {
                    bkg.removeSite(name,(res)=>{
                        if (res.error) {
                            return alert(res.error);
                        }
                        $(this).remove();
                    })

                 }
             } else if ($(e.target).is(".kp-wl-site-check")) {
                 const checked = "check_box", unchecked ="check_box_outline_blank";
                 var icon = $(e.target)[0].getElementsByTagName("i").length > 0 ? $(e.target)[0].getElementsByTagName("i")[0] : $(e.target)[0];
                 var value = icon.innerHTML.trim();
                 if (value === checked) {
                    bkg.toggleSite( name, false, res => {
                         if (res.error) {
                             return alert(res.error);
                         }
                         icon.innerHTML = unchecked;
                         $(this).find("button.kp-wl-url-delete, button.kp-wl-url-check").attr("disabled", "disabled");
                         $(this).find("i.kp-wl-url-delete").removeClass("enable");
                         $(this).find("i.kp-wl-url-check").each((i,x) => {
                             x.innerHTML = unchecked;
                             $(x).removeClass("enable");
                         });
                     });
                 } else {
                    bkg.toggleSite( name, true, res => {
                         if (res.error) {
                             return alert(res.error);
                         }
                         $(this).find("button.kp-wl-url-delete, button.kp-wl-url-check").removeAttr("disabled");
                         $(this).find("i.kp-wl-url-delete").addClass("enable");
                         $(this).find("i.kp-wl-url-check").each((i,x) => {
                             x.innerHTML = checked;
                             $(x).addClass("enable");
                         });
                         icon.innerHTML = checked;
                     });
                 }
             }
         });
         $(".kp-wl-url-row").on("click", function(e){
             e.stopPropagation();
             if ($(e.target).is(".kp-wl-url-delete.enable")) {
                 let url = $(this).data("url");
                 bkg.removeURL( url, res => {
                     if (res.error) {
                         return alert(res.error);
                     }
                     $(this).remove();
                 });
             }
             if ($(e.target).is(".kp-wl-url-check.enable")) {
                 let url = $(this).data("url");
                 const checked = "check_box", unchecked ="check_box_outline_blank";
                 let icon = $(e.target)[0].getElementsByTagName("i").length > 0 ? $(e.target)[0].getElementsByTagName("i")[0] : $(e.target)[0];
                 let value = icon.innerHTML.trim();
                 if (value === checked) {
                     bkg.toggleURL( url,false, res => {
                         if (res.error) {
                             return alert(res.error);
                         }
                         icon.innerHTML = unchecked;
                     });
                 } else {
                    bkg.toggleURL( url,  true, res => {
                         if (res.error) {
                             return alert(res.error);
                         }
                         icon.innerHTML = checked;
                     });
                 }
             }
         });


         return;

  });

}

function renderSafeDomainTable() {
    $(".kp-safelist").empty();
    let safeSites = bkg.getSafeDomainsData();

    safeSites.forEach(x => {
        $(".kp-safelist").append(templateSafeDomain(x));
    });

    $(".kp-safelist-row").on("click", function(e) {
        //e.preventDefault();
        if ($(e.target).is(".kp-sl-delete")) {
            var domain = $(this).data("name");
            var res = confirm("Do you want to delete " + domain + " from the list of safe domains?");
            if (res) {
                bkg.removeSafeDomain( domain, res => {
                    if (res.error) {
                        return alert(res.error);
                    }
                    $(this).remove();
                });
            }
        }
    });
}
function renderAvailableModels(){
    $('#kp-models').empty();
    $.each(bkg.getAvailableModels(), function (i, item) {
        $('#kp-models').append(`   <li id="${item.name}" class="mdl-list__item  mdl-list__item--three-line">
        <span class="mdl-list__item-primary-content ">
            <span>${item.label}</span>
            <span class="mdl-list__item-text-body">

            </span>

        </span>
        <span class="  mdl-list__item-secondary-content mdl-cell mdl-cell--3-col ">
        <div class="mdl-textfield mdl-js-textfield mdl-textfield--floating-label">
            <input class= " weightage-input mdl-textfield__input"  type="number" min="0" value="${item.weightage}"
            max="100">
            <label class="mdl-textfield__label" >% weightage
                </label>
            <span class="mdl-textfield__error">Only 0 to 100</span>
        </div>

    </span>
        <span class=" mdl-list__item-secondary-content ">
            <label class=" mdl-switch mdl-js-switch mdl-js-ripple-effect"
                >
                <input  type="checkbox"  ${item.selected?"checked":""}
                    class=" select-switch mdl-switch__input" />
            </label>
        </span>


        <span class= " mdl-list__item-secondary-content ">
            <button
                class=" delete mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect mdl-button--accent  ">
                <i class="material-icons">delete</i>
            </button>
        </span>



    </li>`);
    });
}
function initAdvanceTab() {
    if (bkg.getDebugFlag()) {
        $("#kp-debug-switch").click();
    }
    if(bkg.getSecureImageFlag()){
        $("#kp-secure-image-switch").click();
    }
   renderAvailableModels()
    $("#kp-secure-image-duration").val(bkg.getSecureImageDuration());

}

$(document).ready( function() {

   setTimeout(()=>{
    if(bkg.getRestoreMsg()){
        backupReminderDialog.showModal()
    }
   },500)

  $("#version") .html( chrome.runtime.getManifest().version)

    setTimeout(
        function(){
            renderProtectedList();
            renderSafeDomainTable();

        },1000)

    let params = getUrlVars();
    if (params["tab"]) {

    $(params["tab"]).addClass("is-active");

        if (params["host"]) {
            $("label[for=kp-safelist-input]").attr("style", "visibility: hidden");
            $("#kp-safelist-input").focus();
            $("#kp-safelist-input").val(params["host"]);
        }
    }else{
        $("#tab-secure-img").addClass("is-active");

    }

    initAdvanceTab();
    updateImage();
    defaultImages.forEach(function(img) {
        let imagePath = "assets/img/secure_img/" + img;
        $("#imagegallery .mdl-cell:last").before(templateImage(imagePath, "favorite_border"));
    });

    $(".set-image").on("click", function(event) {
        event.preventDefault();
        var data = {};
        data.type = "suggested";
        var img = $(this).find("img")[0];
        data.src = img.src;
        updateImage(data);

        $(".kp-active-icons").text("favorite_border");

        if (data.type != "custom"){
            if (!$("#customimage").attr("src")){
                $("#kp-custom-icons").text("");
            }
        }

        var icon = $(this).find("i")[0];
        $(icon).text("favorite");
    });

    $("#kp-custom-btn-icons").on("click", function(event) {
        $(".kp-custom-icons").click();
    });

    $(".kp-custom-icons").on("click", function(event) {
        var data = {};
        event.preventDefault();
        data.type = "custom";
        data.src = $("#customimage").attr("src");
        if (data.src) {
            updateImage(data);
            $(".kp-active-icons").text("favorite_border");
            $("#kp-custom-icons").text("favorite");
        }
    });

    $(".img-edit").on("click", function(e) {
        $(".whitelist-container").addClass("hide");
        $(".img-uploader-container").removeClass("hide");
    });

    $("#imageUpload").on("click", function(e) {

        $("#custom-img").click();
    });
    $("#backupFileUpload").on("click", function(e) {
        $("#backup-file").click();
    });

    $("#backup-file").change(function(e) {
        let file = e.target.files[0];
        let reader = new FileReader();
        reader.onloadend = function() {
            let fileData = reader.result;
            let jsonData;
            try {
                jsonData = JSON.parse(fileData);
            }
            catch (err) {
                $("#notifications").text("Please upload a valid file").css("visibility", "visible").css("color", "red");
                setTimeout(function(){ $("#notifications").css("visibility","hidden"); }, 6000);
                return;
            }

            bkg.restoreBackup(jsonData, function(error){

                let msg = "",
                    color = "";
                if (error){
                    msg = "Something went wrong, Error: " + error.message;
                    color = "#FF5722";
                } else {
                    // initAdvanceTab();
                    // updateImage();

                    msg = "Restore data completed successfully.";
                    color = "#4CAF50";
                }
                $("#notifications").text(msg).css("visibility", "visible").css("color", color);

                setTimeout(function(){ $("#notifications").css("visibility","hidden"); }, 6000);
                if (params["tab"]) {
                    location.reload();
                }else{
                    window.location.href = window.location.href.replace( /[\?#].*|$/, "?tab=#tab-advanced" );

                }
            });

        };
        reader.readAsText(file);
    });

    $("#custom-img").change(function(e) {

        var file = e.target.files[0];
        if (!file.type.startsWith("image")) {
            alert("You have uploaded a file of type : " + file.type + ".\n Please upload a valid image file.");
            return;
        }
        if (file.size > 2097154) {
            alert("The image size should not be more than 2MB");
            return;
        }
        var reader = new FileReader();
        reader.onloadend = function() {
            var data = {};
            data.type = "custom";
            data.src = reader.result;
            updateImage(data);
            // $("#imagegallery .cutsom-image").remove();
            $("#imagegallery #customimage").attr("src", reader.result);
            $(".kp-active-icons").text("favorite_border");
            $("#imagegallery #kp-custom-icons").text("favorite");
            // $("#imagegallery .mdl-cell:last").before(templateImage(reader.result, "favorite", "cutsom-image"));
            $("#imageUpload").text("Change Image");
        };
        reader.readAsDataURL(file);

    });
    $("#kp-remove").on("click", function(e) {
        bkg.backupDB( function(backupData) {
           download(backupData);
            bkg.unInstallPlugin();
        });

    })
    $("#kp-restore-factory").on("click", function(e) {
        if (confirm("This will delete all personal images, protected pages and image snippets added by you. Restore factory defaults?")) {
            bkg.cleanDB(function(){
                bkg.setDefaultSecurityImage(function () {
                    $("#imagegallery .cutsom-image").remove();
                    $("#imagegallery #customimage").attr("src", "");
                    $("#imagegallery #kp-custom-icons").text("");
                    $("#imageUpload").text("Upload New Image");
                    updateImage();
                });
                let val = $("#kp-debug-switch").is(":checked");
                if (val) {
                    $("#kp-debug-switch").click();
                }
                let val1 = $("#kp-secure-image-switch").is(":checked");
                if (!val1) {
                    $("#kp-secure-image-switch").click();
                }
                $("#kp-secure-image-duration").val(1);
                bkg.setSecureImageDuration(1);
                bkg.setFactoryAvailableModels()
                weightMessage()
                if (params["tab"]) {
                    location.reload();
                }else{
                    window.location.href = window.location.href.replace( /[\?#].*|$/, "?tab=#tab-advanced" );

                }

            });
        }
    });

    // get backup of all the custom settings
    $("#sp-backup").on("click", function(e) {
        bkg.backupDB(function(backupData) {
            download(backupData);
            $("#notifications").text("Backup has completed successfully.").css("visibility", "visible").css("color", "green");
            setTimeout(function(){ $("#notifications").css("visibility","hidden"); }, 5000);
        });
    });

    // download db backup file
    function download(content) {
        let a = document.createElement("a");
        let blob = new Blob([JSON.stringify(content, null, 4)], {"type": "application/json"});
        a.href = window.URL.createObjectURL(blob);
        let date =  new Date();
        let datetime = date.getFullYear().toString() + (date.getMonth() + 1).toString() +  date.getDate().toString() + date.getHours().toString() + date.getMinutes().toString() + date.getSeconds().toString();
        a.download = `SpotPhish-backup-${datetime}.json`;
        a.click();
    }


    $(".kp-safelist-add-btn").on("click", function(e) {
        let input = $("#kp-safelist-input").val().trim();
        let val;
        if (input.length > 0) {
            let urlPattern = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?/;
            let continousString = /^\S*$/;
            if (urlPattern.test(input)) {
                val = bkg.getPathInfo(input).host;
            } else if (continousString.test(input)) {
                val = input;
            } else {
                alert("Incorrect domain entered, please try again");
                return;
            }
            bkg.addSafeDomain( val, res => {
                if (res.error) {
                    return alert(res.error);
                }
                renderSafeDomainTable();
            });
        }
        $("#kp-safelist-input").val("");

    });
    $("#kp-debug-switch").on("click", function(e) {
        let val = $(this).is(":checked");
        if (val) {
            bkg.setDebugFlag(true);
        } else {
            bkg.setDebugFlag(false);
        }
    });
    $("#kp-secure-image-switch").on("click", function(e) {
        let val = $(this).is(":checked");
        if (val) {
            bkg.setSecureImageFlag(true);
        } else {
            bkg.setSecureImageFlag(false);
        }
    });
    $("#kp-models .select-switch").on("click", function(e) {

        let val = $(this).is(":checked");
        console.log(val);
        if (val) {
            bkg.selectModel($(this).closest('li').attr('id'));
        } else {
            bkg.unSelectModel($(this).closest('li').attr('id'));
        }
        weightMessage()
    });
    $("#kp-models .delete").on("click", function(e) {
        let x=$(this).closest('li').attr("id");

        if(  x!=="TemplateMatching" ) {
            bkg.removeAvailableModels(x);
            if (params["tab"]) {
                location.reload();
            }else{
                window.location.href = window.location.href.replace( /[\?#].*|$/, "?tab=#tab-advanced" );
            }
            }else{
            alert("You cannot delete this model. Disable it if you want.")
        }
        weightMessage();
    });
    $("#kp-models .weightage-input").on("change paste keyup", function(e) {
        bkg.setWeightage( $(this).closest('li').attr("id"),parseInt( $(this).val()))
        weightMessage()

    });
    $("#kp-secure-image-duration").on("change paste keyup", function(e) {
        let val = $(this).val();
        if(val===""){
            bkg.setSecureImageDuration(1);
        }
        else{
            bkg.setSecureImageDuration(val);
        }
    });
    var dialog = document.querySelector('#addModelDialog');
    var backupReminderDialog = document.querySelector('#backupReminderDialog');

    var showDialogButton = document.querySelector('#kp-show-add-model-dialog');
    if (! dialog.showModal) {
      dialogPolyfill.registerDialog(dialog);
    }
    if (! backupReminderDialog.showModal) {
        dialogPolyfill.registerDialog(backupReminderDialog);
      }
    showDialogButton.addEventListener('click', function() {
      dialog.showModal();

    });
    dialog.querySelector('.close').addEventListener('click', function() {
      dialog.close();

    });
    backupReminderDialog.querySelector('.close').addEventListener('click', function() {
        backupReminderDialog.close();
    bkg.setRestoreMsg()
    });

      backupReminderDialog.querySelector('.restore-now').addEventListener("click",function(e) {
        backupReminderDialog.close();
    bkg.setRestoreMsg()

        $("#backupFileUpload").click();



    });
    dialog.querySelector('#label').addEventListener("change", function(e) {
       if(modelNameExists($(this).val().trim().replace(/\s+/g,"_"))){alert("Name already exists");$(this).val(template_of_MLmodel.label);return;}
        template_of_MLmodel.label=($(this).val().trim());
        template_of_MLmodel.name=($(this).val().trim()).replace(/\s+/g,"_");


    });
    $("#checks").hide()

    dialog.querySelector('#src').addEventListener("change",async function(e) {
       let srcFile=$(this).val().trim();
        if(! srcFile.includes("https://cdn.jsdelivr.net/"))
        {alert("Unauthorized domain"); $(this).val(template_of_MLmodel.src);return;}
       let remoteFile=(await import(srcFile));
       let Model=remoteFile.default;
        if(Model!==undefined){

                    if(Model.prototype.predict!=null && (typeof Model.prototype.predict)==="function"  ){
                   $("#exportedClassName").html("class "+Model.name);

                        $("#checks").show()


                       if (Model.dependencies!==undefined && Array.isArray(Model.dependencies)){
                            template_of_MLmodel.dependencies=Model.dependencies;
                       }else{
                            template_of_MLmodel.dependencies=[];

                       }
                    }else{
                        alert("Does not contain the predict function")
                        $(this).val(template_of_MLmodel.src);
                        return;
                    }
        }else{
                alert("Some class must be exported");
                $(this).val(template_of_MLmodel.src);
                return;
            }
            template_of_MLmodel.src=srcFile;
            $("#dependencies").empty();
            $.each(template_of_MLmodel.dependencies, function (i, item) {
                     $("#dependencies").append(`<p>${item}</p>`);
                 });

    });

    dialog.querySelector('#addModel').addEventListener("click",async function(e) {
        if(!validateModel()){alert("All fields are mandatory");return;}

            bkg.setAvailableModels(template_of_MLmodel);
            template_of_MLmodel={
                name:"",
                        src:"",
                        label:"",
                        dependencies:[],
                        selected:false,
                        weightage:0,
                        webgl:false
                    };


            dialog.close();
            if (params["tab"]) {
                location.reload();
            }else{
                window.location.href = window.location.href.replace( /[\?#].*|$/, "?tab=#tab-advanced" );

            }


    });

    weightMessage();

});

function validateModel(){
  if(
   ! isEmpty(template_of_MLmodel.label)&&
   ! isEmpty(template_of_MLmodel.src) ){
    return true;
   }
   return false;
}
function modelNameExists(model_name){
    return _.find(bkg.getAvailableModels(),x=>x.name===model_name)
  }
function isEmpty(str) {
    return (!str || 0 === str.length);
}
function getSum(total, num) {
    return total + num.weightage;
}
function weightMessage(){
    let total= bkg.getAvailableModels().filter(item=>item.selected).reduce(getSum, 0);

    if(total>100){
        $("#total-weight").html("Total exceeding 100%")

    }else  if(total<100){
        $("#total-weight").html("Please ensure total weight is 100%");
    }else{
        $("#total-weight").html("Total Weightage : 100%");

    }
}