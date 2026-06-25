# Paragraf Web (glar) — рендерер (форк opencode). Собирается в статику для деплоя.
# Бэкенд (engine/billing/gateway) — в других репо (paragraf-monorepo + paragraf-gateway).

SHELL := bash
.DEFAULT_GOAL := help

BUN ?= bun

.PHONY: help install dev web build typecheck test

help: ## список команд
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n",$$1,$$2}'
	@echo ""
	@echo "Веб нужен бэкенд: подними paragraf-monorepo (make up) + ../paragraf-gateway, потом make dev"

install: ## установить зависимости
	@$(BUN) install

web: ## запустить рендерер (vite, :5173)
	@$(BUN) run dev:web

dev: web ## алиас для web

build: ## собрать статику для прода (→ packages/app/dist)
	@$(BUN) run --cwd packages/app build

typecheck: ## typecheck приложения
	@$(BUN) --cwd packages/app run typecheck

test: ## unit-тесты приложения
	@$(BUN) --cwd packages/app run test:unit
