BASE_SCSS = src/_base.scss

%.css: src/%.scss $(BASE_SCSS)
	sass -C --scss $< $@

CSS = content.css kp-style.css option.css popup.css

all: $(CSS)


clean:
	rm -f $(CSS)
