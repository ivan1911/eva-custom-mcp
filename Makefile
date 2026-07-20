NPM_CACHE ?= /tmp/eva-custom-mcp-npm-cache

.PHONY: build typecheck publish publish-dry-run

build:
	npm run build

typecheck:
	npm run typecheck

publish: build
	@test -n "$$NODE_AUTH_TOKEN" || (echo "NODE_AUTH_TOKEN is required" >&2; exit 1)
	@npm_config_cache="$(NPM_CACHE)" npm publish --access public

publish-dry-run: build
	@npm_config_cache="$(NPM_CACHE)" npm publish --dry-run --access public
