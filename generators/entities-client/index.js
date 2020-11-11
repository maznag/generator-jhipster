/**
 * Copyright 2013-2020 the original author or authors from the JHipster project.
 *
 * This file is part of the JHipster project, see https://www.jhipster.tech/
 * for more information.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const BaseBlueprintGenerator = require('../generator-base-blueprint');

let useBlueprints;

module.exports = class extends BaseBlueprintGenerator {
    constructor(args, opts) {
        super(args, opts);

        if (this.options.help) return;

        this.clientEntities = this.options.clientEntities;

        useBlueprints = !this.fromBlueprint && this.instantiateBlueprints('entities-client');
    }

    // Public API method used by the getter and also by Blueprints
    _initializing() {
        return {
            validateFromCli() {
                this.checkInvocationFromCLI();
            },
        };
    }

    get initializing() {
        return useBlueprints ? undefined : this._initializing();
    }

    // Public API method used by the getter and also by Blueprints
    _loading() {
        return {
            loadSharedConfig() {
                this.loadClientConfig();
            },
        };
    }

    get loading() {
        return useBlueprints ? undefined : this._loading();
    }

    // Public API method used by the getter and also by Blueprints
    _default() {
        return {
            loadUserManagementEntities() {
                if (!this.configOptions.sharedEntities) return;
                // Make user entity available to templates.
                this.user = this.configOptions.sharedEntities.User;
            },
        };
    }

    get default() {
        return useBlueprints ? undefined : this._default();
    }

    // Public API method used by the getter and also by Blueprints
    _end() {
        return {
            end() {
                if (!this.options.skipInstall) {
                    this.rebuildClient();
                }
            },
        };
    }

    get end() {
        return useBlueprints ? undefined : this._end();
    }
};
