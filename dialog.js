function showSecureImg(msg={text: "Verified as genuine"}) {
    const icon = chrome.extension.getURL("assets/icons/icon128.png"),
        title = msg.title || "Security Image",
        text = msg.text ? `<div class="kpmdl-card__supporting-text">${msg.text}</div>` : "",
        template = `
<div class="kp-dialog kp-dialog-info">
    <div class="kpmdl-card kpmdl-shadow--16dp">
        <div class="kpmdl-card__title kpmdl-color--primary kpmdl-color-text--primary-contrast">
            <div class="kpmdl-card__title-text"><img class="kp-title-icon" src="${icon}"> &nbsp;${title}</div>
        </div>
        <div class="kpmdl-card__menu">
            <button class="kpmdl-button kpmdl-button--icon">
                <i class="material-icons">clear</i>
            </button>
        </div>
        <div class="kp-image-container">
        </div>
        ${text}
    </div>
</div>`;

    function cleanup() {
        $(".kp-dialog").css({opacity: 0});
        setTimeout(x => $(".kp-dialog").remove(), 400);
    }
    $("body").prepend(template);
    setTimeout(x => $(".kp-dialog").css({opacity: 1}), 50);
    setTimeout(cleanup, 3500);

    $(".kp-dialog .kpmdl-button").on("click", function(e) {
        e.preventDefault();
        cleanup();
    });

    chrome.storage.local.get("secure_img", function(result) {
        var data = result.secure_img;
        if (data === undefined) {
            data = {};
            data.type = "default";
            data.src = DEFAULT_IMG;
            updateImage(data);
            return;
        }
        var img = document.createElement("img");
        img.id = "kp-secure-img";
        img.src = data.src;
        $(".kp-image-container").append(img);
    });
}

function showWarning(msg={text: "Phish phish!"}) {
    const icon = chrome.extension.getURL("assets/icons/icon128.png"),
        title = msg.title || "Are you being phished?",
        text = msg.text ? `<div class="kpmdl-card__supporting-text">${msg.text}</div>` : "",
        template = `
<div class="kp-dialog kp-dialog-warning">
    <div class="kpmdl-card kpmdl-shadow--16dp">
        <div class="kpmdl-card__title kpmdl-color--accent kpmdl-color-text--primary-contrast">
            <div class="kpmdl-card__title-text"><img class="kp-title-icon" src="${icon}"> &nbsp;${title}</div>
        </div>
        <div class="kpmdl-card__menu">
            <button class="kpmdl-button kpmdl-button--icon">
                <i class="material-icons">clear</i>
            </button>
        </div>
        <div class="kp-image-container">
        </div>
        ${text}
        <div class="kpmdl-card__supporting-text">
            In case of frequent false alarms on a trusted site, add it to the <em>Safe Domains</em> list.
        </div>
        <div class="kpmdl-card__actions kpmdl-card--border">
            <button class="kpmdl-button kpmdl-button--colored">Dismiss</button>
            <button class="kpmdl-button kpmdl-button--colored kpmdl-button--disabled">Report Phishing</button>
        </div>
    </div>
</div>`;

    function cleanup() {
        $(".kp-dialog").css({opacity: 0});
        setTimeout(x => $(".kp-dialog").remove(), 400);
    }

    $("body").prepend(template);
    setTimeout(x => $(".kp-dialog").css({opacity: 1}), 50);

    $(".kp-dialog .kpmdl-button").on("click", function(e) {
        e.preventDefault();
        cleanup();
    });
}
