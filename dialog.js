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
        extra = d.extra ? `<div class="kpmdl-card__supporting-text">${d.extra}</div>` : "",
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
