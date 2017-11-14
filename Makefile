BG_SOURCES = externalCode/idbstore.min.js\
	utils.js\
	screenshot.js\
	background.js\
	orb-features.js\
	externalCode/jsfeat.js

CS_SOURCES = externalCode/jquery/jquery-1.12.4.min.js\
        externalCode/jquery.Jcrop.min.js\
        utils.js\
        content.js

CHECK_SOURCES = background.js model.js orb-features.js content.js popup.js option.js dialog.js screenshot.js utils.js

BACKGROUND = js/bg.js
CONTENT = js/cs.js

all: check

$(BACKGROUND): $(BG_SOURCES)
	cat $^ > $@

$(CONTENT): $(CS_SOURCES)
	cat $^ > $@

check: $(BG_SOURCES) $(CS_SOURCES)
	eslint $(CHECK_SOURCES)

css: .PHONY
	make -C css

clean:
	rm $(BACKGROUND) $(CONTENT)

firefox:
	 sed -i -e 's/chrome-extension/moz-extension/g' css/iconfont/material-icons.css

chrome:
	 sed -i -e 's/moz-extension/chrome-extension/g' css/iconfont/material-icons.css

.PHONY:
