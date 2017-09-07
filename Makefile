REPORTER = spec
TESTS = tests/*.js

test:
	for check in $(TESTS); \
	do \
	    ./node_modules/.bin/mocha --reporter $(REPORTER) $$check || exit 1; \
	done

postinstall:
ifeq ($(NODE_ENV),travis)
	rm -f README.md
else
	exit 0; \
	rm -fr README.md circle.yml tests
endif
