# GUSTO · atalhos (Regra de Arte: tudo reprodutível) · by m3d.pro
SHELL := /bin/bash
ENV ?= .env
DC := docker compose --env-file $(ENV)

.PHONY: ajuda env up down logs ps test migrar backup teste promover setup-vps
ajuda:          ## lista os comandos
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed -E 's/:.*## /\t/'
env:            ## cria .env local a partir do exemplo
	@test -f .env || { cp .env.example .env; echo ".env criado — revise as senhas"; }
up: env         ## sobe a stack local (http://localhost:3301)
	$(DC) up -d --build
down:           ## para a stack local
	$(DC) down
logs:           ## logs da app
	$(DC) logs -f --tail=100 app
ps:             ## estado dos serviços
	$(DC) ps
test:           ## testes unitários
	cd app && npm ci --no-audit --no-fund && npm test
migrar:         ## aplica migrações pendentes
	$(DC) run --rm migrate
backup:         ## dump imediato do banco em ./backups
	mkdir -p backups && $(DC) exec -T db pg_dump -U postgres --no-owner gusto | gzip > backups/gusto-$$(date +%F-%H%M).sql.gz
teste:          ## publica a branch atual em homologação (/teste/)
	git push origin HEAD:teste
promover:       ## promove teste → main (produção) pelo GitHub Actions
	gh workflow run promover.yml -f confirmacao=PROMOVER
setup-vps:      ## prepara a VPS: make setup-vps VPS=root@159.223.22.82 EMAIL=voce@x
	scp -r deploy $(VPS):/tmp/gusto-deploy && ssh -t $(VPS) "sudo bash /tmp/gusto-deploy/setup-vps.sh --dominio gusto.m3d.pro --email $(EMAIL)"
