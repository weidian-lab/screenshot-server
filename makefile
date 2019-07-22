LINT = $(PWD)/node_modules/.bin/eslint

COMMIT_HASH = $(shell git rev-parse HEAD)

PACKAGE_NAME := $(shell node -p "require('./package.json').name")
PACKAGE_VERSION := $(shell node -p "require('./package.json').version")
DOCKER_REGISTRY ?= registry.cn-hangzhou.aliyuncs.com
DOCKER_NAMESPACE ?= weidian-lab
NAMESPACE ?= $(shell node -p "require('./package.json').weidian.namespace")
APP_ENV ?= development

export APP_ENV
export NAMESPACE
export APP_NAME=$(PACKAGE_NAME)
export CI_COMMIT_SHA=$(COMMIT_HASH)

CONTAINER_IMAGE = $(DOCKER_REGISTRY)/$(DOCKER_NAMESPACE)/$(NAMESPACE)-$(PACKAGE_NAME)

install:
	  yarn

lint: install
	  ${LINT} --format 'node_modules/eslint-friendly-formatter' --fix --ext .js app

test: lint
	yarn lint
	yarn test

baseDockerImg:
	docker build -f Dockerfile.base -t $(CONTAINER_IMAGE):base-$(PACKAGE_VERSION) .
	docker push $(CONTAINER_IMAGE):base-$(PACKAGE_VERSION)
	sed -i '1c FROM $(CONTAINER_IMAGE):base-$(PACKAGE_VERSION)' Dockerfile

prodDockerImg:
	docker pull $(CONTAINER_IMAGE):latest || true
	docker build --cache-from $(CONTAINER_IMAGE):latest -t $(CONTAINER_IMAGE):$(COMMIT_HASH) --tag $(CONTAINER_IMAGE):latest .
	docker push $(CONTAINER_IMAGE):$(COMMIT_HASH)
	docker push $(CONTAINER_IMAGE):latest

deployDev:
	envsubst < env.yml | kubectl apply -f -
	envsubst < deployment-dev.yml | kubectl apply -f -

deployProd:
	envsubst < deployment-prod.yml | kubectl apply -f -

env:
	envsubst < env.yml > env-$(APP_ENV).yml

.PHONY: install lint baseDockerImg prodDockerImg deployDev deployProd env
