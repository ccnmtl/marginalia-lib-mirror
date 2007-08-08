#
# makefile for marginalia-lib
#

MARGINALIA_LIB_DIR = $(shell pwd)/marginalia
include marginalia-lib.mk

DATE = $(shell date +'%Y%m%d')

OUTDIR = /Users/geof/Work/Marginalia/Releases
OUTNAME = marginalia-lib-$(DATE)
ZIPDIR = $(OUTDIR)/$(OUTNAME)

TEST_FILES = \
 test/app \
 test/app/emptyPage.html \
 test/app/jsUnitCore.js \
 test/app/jsUnitMockTimeout.js \
 test/app/jsUnitTestManager.js \
 test/app/jsUnitTestSuite.js \
 test/app/jsUnitTracer.js \
 test/app/jsUnitVersionCheck.js \
 test/app/main-counts-errors.html \
 test/app/main-counts-failures.html \
 test/app/main-counts-runs.html \
 test/app/main-counts.html \
 test/app/main-data.html \
 test/app/main-errors.html \
 test/app/main-frame.html \
 test/app/main-loader.html \
 test/app/main-progress.html \
 test/app/main-results.html \
 test/app/main-status.html \
 test/app/testContainer.html \
 test/app/testContainerController.html \
 test/app/xbDebug.js \
 test/app/css/jsUnitStyle.css \
 test/css/jsUnitStyle.css \
 test/testRunner.html \
 test/tests/test-suite.html \
 test/tests/annotation.html \
 test/tests/domutil.html \
 test/tests/domwalker.html \
 test/tests/highlight.html \
 test/tests/ranges.html
 
README_FILES = \
 README.txt \
 LICENSE.txt \
 CREDITS.txt

DOC_FILES = \
 docs/CREDITS.html \
 docs/README.html

UTIL_FILES = \
 util/dtd2js.pl \
 util/html.dtd
 
release:  zipdir docs
	cd $(OUTDIR); tar czf $(OUTNAME).tgz $(OUTNAME)

zipdir: $(MARGINALIA_LIB_FILES) $(UTIL_FILES) $(DOC_FILES) $(README_FILES)
	mkdir -p $(ZIPDIR)/marginalia
	mkdir -p $(ZIPDIR)/util
	mkdir -p $(ZIPDIR)/doc
	mkdir -p $(ZIPDIR)/test
	cp $(MARGINALIA_LIB_FILES) $(ZIPDIR)/marginalia
	cp -r $(TEST_FILES) $(ZIPDIR)/test
	cp $(UTIL_FILES) $(ZIPDIR)/util
	cp $(DOC_FILES) $(ZIPDIR)/doc
	cp $(README_FILES) $(ZIPDIR)
	
%.txt: docs/%.html
	html2txt $< >$@
	
clean-zip:
	rm -r $(ZIPDIR)

