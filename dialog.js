function dialog(obj={}) {
    const icon = chrome.extension.getURL("assets/icons/icon128.png"),
        d = Object.assign({}, {title: "KillPhisher",
            type: "info",
            main: "",
            img: "",
            extra: "",
            buttons: [],
            dismiss_after: 0
        }, obj),
        titlecol = d.type === "info" ? "kpmdl-color--primary" : "kpmdl-color--accent",
        img = d.img ? `<div class="kp-image-container"></div>` : "",
        main = d.main ? `<div class="kpmdl-card__supporting-text kp-main">${d.main}</div>` : "",
        extra = d.extra ? `<div class="kpmdl-card__supporting-text kp-extra">${d.extra}</div>` : "",
        buttons = d.buttons.length ? `<div class="kpmdl-card__actions kpmdl-card--border">` +
            d.buttons.map(x => x.html).join(" ") + `</div>` : "",
        template = `
<div class="kp-dialog kp-dialog-${d.type}">
    <div class="kpmdl-card kpmdl-shadow--16dp">
        <div class="kpmdl-card__title ${titlecol} kpmdl-color-text--primary-contrast">
            <div class="kpmdl-card__title-text"><img class="kp-title-icon" src="${icon}"> &nbsp;${d.title}</div>
        </div>
        <div class="kpmdl-card__menu">
            <button class="kpmdl-button kpmdl-button--icon kp-dialog-clear">
                <i class="material-icons">clear</i>
            </button>
        </div>
        ${main}
        ${img}
        ${extra}
        ${buttons}
    </div>
</div>`;

    function cleanup() {
        $(document).off("keyup", esc);
        $(".kp-dialog").css({opacity: 0});
        setTimeout(x => $(".kp-dialog").remove(), 400);
    }

    $("body").prepend(template);
    if (d.img) {
        $(".kp-image-container").append(d.img);
    }
    setTimeout(x => $(".kp-dialog").css({opacity: 1}), 50);
    $(document).on("keyup", esc);

    $(".kp-dialog-clear").on("click", function(e) {
        e.preventDefault();
        cleanup();
    });
    $(".kp-dialog .kpmdl-button").on("click", function(e) {
        e.preventDefault();
        const i = $(e.target).attr("kp-button-index"),
            handler = d.buttons[i] ? d.buttons[i].onclick : null;
        cleanup();
        handler && handler();
    });
    if (d.dismiss_after) {
        setTimeout(cleanup, d.dismiss_after);
    }

    function esc(e) {
        if (e.which === 27) {
            cleanup();
        }
    }
}

function loadPixel() {
    return new Promise(resolve => {
        var image = new Image();
        image.id = "kp-one-px";
        image.onload = () => {
            $("body").append(image);
            return resolve(null);
        };
        image.src = chrome.runtime.getURL("/assets/img/pixel.png");
    });
}

function startCrop() {
    let jc,
        sel = null,
        menuShown = false;

    return new Promise(resolve => {
        function esc(e) {
            if (e.which === 27) {
                sel = null;
                cleanup();
            }
        }

        function cleanup() {
            $("#kp-one-px").remove();
            $(".jcrop-holder").remove();
            $(document).off("keyup", esc);
            jc && jc.destroy();
            return requestAnimationFrame(x => requestAnimationFrame(x => resolve(sel)));
        }

        function showMenu() {
            const menu = `
            <div class="kp-crop-container" style="position: absolute; top:${sel.y + sel.h + 2}px; left: ${sel.x}px; width: ${sel.w}px;">
                <div class="kp-crop-menu">
                <button class="kpmdl-button kpmdl-button--accent kpmdl-button--raised kpmdl-button--icon kp-crop-clear"><i class="material-icons">clear</i></button>
                <button class="kpmdl-button kpmdl-button--accent kpmdl-button--raised kpmdl-button--icon kp-crop-done"><i class="material-icons">done</i></button>
                </div>
            </div>`;
            $(".jcrop-holder").append(menu);
            menuShown = true;
            $(".kp-crop-clear").on("click", x => {
                sel = null;
                cleanup();
            });
            $(".kp-crop-done").on("click", cleanup);
        }

        function hideMenu() {
            if (!menuShown) return;
            $(".kp-crop-menu").remove();
            menuShown = false;
        }

        $("#kp-one-px").Jcrop({
            bgColor: "none",
            maxSize: [500, 300],
            minSize: [30, 30],
            keySupport: false,
            onSelect: e => {
                sel = e;
                showMenu();
            },
            onChange: e => {
                sel = e;
                hideMenu(); 
            },
            onRelease: e => {
                sel = null;
                hideMenu(); 
            }
        }, function() {
            jc = this;
            $(".jcrop-hline, .jcrop-vline").css({
                backgroundImage: "url(" + chrome.runtime.getURL("/assets/img/Jcrop.gif") + ")"
            });
            $(document).on("keyup", esc);
        });
    });
}

function injectErrorModal() {
    const cropDialog = {
        title: "Error!",
        type: "info",
        main: "Selected area is not distinctive enough",
        extra: "<div>The area is too small or has too few details to be recognized.</div>",
        buttons: [{html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=0>Try again</button>`, onclick: crop},
            {html: `<button class="kpmdl-button kpmdl-button--colored" kp-button-index=1>Cancel</button>`, onclick: null} ]
    };

    dialog(cropDialog);
}

function crop() {
    loadPixel()
        .then(startCrop)
        .then(sel => {
            if (sel) {
                chrome.runtime.sendMessage({
                    op: "crop_capture",
                    area: sel,
                    dpr: devicePixelRatio
                }, function (res) {
                    if (res.message == "failed") {
                        injectErrorModal();
                    } else {
                        injectAckModal();
                    }
                });
            } else {
                /* Display cancel notification */
            }
        });
}
