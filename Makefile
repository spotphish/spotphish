BG_SOURCES = externalCode/idbstore.min.js\
	utils.js\
	screenshot.js\
	background.js\
	orb-features.js\
	externalCode/jsfeat.js

CS_SOURCES = externalCode/jquery/jquery-1.12.4.min.js\
        externalCode/jquery.Jcrop.min.js\
        whitelist.js\
        utils.js\
        content.js

CHECK_SOURCES = background.js orb-features.js content.js popup.js option.js

BACKGROUND = js/bg.js
CONTENT = js/cs.js

all: check css
#all: $(BACKGROUND) $(CONTENT)

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

.PHONY:
