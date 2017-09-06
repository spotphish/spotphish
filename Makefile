PWD = $(shell pwd)
BUILD_ROOT = $(PWD)/build
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
BUILD_ROOT_FILES = utils.js\
				   screenshot.js\
				   background.js\
				   orb-features.js\
				   whitelist.js\
				   utils.js\
				   content.js\
				   popup.js\
				   option.js\
				   dialog.js\
				   popup.html\
				   manifest.json\
				   option.html\
				   doc
BUILD_EXTERNAL_FILES = externalCode/jsfeat.js\
					   externalCode/jquery.Jcrop.min.js\
					   externalCode/jquery\
				  	   externalCode/jquery.Jcrop.min.css\
				  	   externalCode/idbstore.min.js\
					   externalCode/code.getmdl.io
					   
BUILD_ASSET_FILES = assets/img\
				 	 assets/icons\
					 assets/defaults\
					 assets/fonts
BUILD_CSS_FILES = css/content.css\
				  css/material-dialog.css\
				  css/iconfont\
				  css/option.css\
				  css/material.blue-red.min.css

BUILD_DIR=$(BUILD_ROOT)/$@
CHECK_SOURCES = background.js orb-features.js content.js popup.js option.js dialog.js

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
	#rm $(BACKGROUND) $(CONTENT)
	rm -rf $(BUILD_ROOT)

firefox: all
	mkdir -p $(BUILD_DIR)
	mkdir -p $(BUILD_DIR)/assets/icons
	mkdir -p $(BUILD_DIR)/css/iconfont
	mkdir -p $(BUILD_DIR)/externalCode
	cp -r  $(BUILD_ROOT_FILES) $(BUILD_DIR)/
	cp -r $(BUILD_EXTERNAL_FILES) $(BUILD_DIR)/externalCode/
	cp -r $(BUILD_ASSET_FILES) $(BUILD_DIR)/assets/
	cp -r $(BUILD_CSS_FILES) $(BUILD_DIR)/css/
	sed -i -e 's/chrome-extension/moz-extension/g' $(BUILD_DIR)/css/iconfont/material-icons.css
	cd $(BUILD_ROOT) && zip -r $(BUILD_DIR).zip $(BUILD_DIR)

chrome: all
	mkdir -p $(BUILD_DIR)
	mkdir -p $(BUILD_DIR)/assets/icons
	mkdir -p $(BUILD_DIR)/css/iconfont
	mkdir -p $(BUILD_DIR)/externalCode
	cp -r  $(BUILD_ROOT_FILES) $(BUILD_DIR)/
	cp -r $(BUILD_EXTERNAL_FILES) $(BUILD_DIR)/externalCode/
	cp -r $(BUILD_ASSET_FILES) $(BUILD_DIR)/assets/
	cp -r $(BUILD_CSS_FILES) $(BUILD_DIR)/css/
	cd $(BUILD_ROOT) && zip -r $(BUILD_DIR).zip $(BUILD_DIR)

.PHONY:
