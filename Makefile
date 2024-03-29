TEST = node_modules/expresso/bin/expresso
TESTS ?= test/*.test.js
SRC = $(shell find lib -type f -name "*.js")

test:
	@NODE_ENV=test ./$(TEST) \
		$(TEST_FLAGS) $(TESTS)

test-cov:
	@$(MAKE) test TEST_FLAGS="--cov"

.PHONY: test test-cov