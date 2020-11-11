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

const chalk = require('chalk');
const { Option } = require('commander');
const didYouMean = require('didyoumean');
const fs = require('fs');
const path = require('path');

const EnvironmentBuilder = require('./environment-builder');
const SUB_GENERATORS = require('./commands');
const JHipsterCommand = require('./jhipster-command');
const { CLI_NAME, logger, getCommand, done } = require('./utils');
const { version } = require('../package.json');
const { packageNameToNamespace } = require('../generators/utils');

const JHIPSTER_NS = CLI_NAME;

const moreInfo = `\n  For more info visit ${chalk.blue('https://www.jhipster.tech')}\n`;

const createProgram = () => {
    return (
        new JHipsterCommand()
            .storeOptionsAsProperties(false)
            .passCommandToAction(false)
            .version(version)
            .addHelpText('after', moreInfo)
            // JHipster common options
            .option(
                '--blueprints <value>',
                'A comma separated list of one or more generator blueprints to use for the sub generators, e.g. --blueprints kotlin,vuejs'
            )
            .option('--no-insight', 'Disable insight')
            // Conflicter options
            .option('--force', 'Override every file', false)
            .option('--dry-run', 'Print conflicts', false)
            .option('--whitespace', 'Whitespace changes will not trigger conflicts', false)
            .option('--bail', 'Fail on first conflict', false)
            .option('--skip-regenerate', "Don't regenerate identical files", false)
            .option('--skip-yo-resolve', 'Ignore .yo-resolve files', false)
            .addOption(new Option('--from-jdl', 'Allow every option jdl forwards').default(false).hideHelp())
    );
};

const rejectExtraArgs = (program, cmd, extraArgs) => {
    // if extraArgs exists: Unknown commands or unknown argument.
    const first = extraArgs[0];
    if (cmd !== 'app') {
        logger.fatal(
            `${chalk.yellow(cmd)} command doesn't take ${chalk.yellow(first)} argument. See '${chalk.white(`${CLI_NAME} ${cmd} --help`)}'.`
        );
    }
    const availableCommands = program.commands.map(c => c._name);

    const suggestion = didYouMean(first, availableCommands);
    if (suggestion) {
        logger.info(`Did you mean ${chalk.yellow(suggestion)}?`);
    }

    const message = `${chalk.yellow(first)} is not a known command. See '${chalk.white(`${CLI_NAME} --help`)}'.`;
    logger.fatal(message);
};

const buildCommands = ({ program, commands = {}, envBuilder, env, loadCommand }) => {
    /* create commands */
    Object.entries(commands).forEach(([cmdName, opts]) => {
        const command = program
            .command(cmdName, '', { isDefault: cmdName === 'app' })
            .description(opts.desc + (opts.blueprint ? chalk.yellow(` (blueprint: ${opts.blueprint})`) : ''))
            .addCommandArguments(opts.argument)
            .addCommandOptions(opts.options)
            .addHelpText('after', opts.help)
            .addAlias(opts.alias)
            .lazyBuildCommand(() => {
                if (!opts.cliOnly || cmdName === 'jdl') {
                    if (opts.blueprint) {
                        // Blueprint only command.
                        const generator = env.create(`${packageNameToNamespace(opts.blueprint)}:${cmdName}`, { options: { help: true } });
                        command.addGeneratorArguments(generator._arguments).addGeneratorOptions(generator._options);
                    } else {
                        const generatorName = cmdName === 'jdl' ? 'app' : cmdName;
                        // Register jhipster upstream options.
                        if (cmdName !== 'jdl') {
                            const generator = env.create(`${JHIPSTER_NS}:${cmdName}`, { options: { help: true } });
                            command.addGeneratorArguments(generator._arguments).addGeneratorOptions(generator._options);

                            const usagePath = path.resolve(generator.sourceRoot(), '../USAGE');
                            if (fs.existsSync(usagePath)) {
                                command.addHelpText('after', `\n${fs.readFileSync(usagePath, 'utf8')}`);
                            }
                        }
                        if (cmdName === 'jdl' || program.opts().fromJdl) {
                            const generator = env.create(`${JHIPSTER_NS}:app`, { options: { help: true } });
                            command.addGeneratorOptions(generator._options, chalk.gray(' (application)'));
                        }

                        // Register blueprint specific options.
                        envBuilder.getBlueprintsNamespaces().forEach(blueprintNamespace => {
                            const generatorNamespace = `${blueprintNamespace}:${generatorName}`;
                            if (!env.get(generatorNamespace)) {
                                return;
                            }
                            const blueprintName = blueprintNamespace.replace(/^jhipster-/, '');
                            try {
                                command.addGeneratorOptions(
                                    env.create(generatorNamespace, { options: { help: true } })._options,
                                    chalk.yellow(` (blueprint option: ${blueprintName})`)
                                );
                            } catch (error) {
                                logger.info(
                                    `Error parsing options for generator ${generatorNamespace}, unknown option will lead to error at jhipster 7`
                                );
                            }
                        });
                    }
                }
                command.addHelpText('after', moreInfo);
            })
            .action((...everything) => {
                // [args, opts, extraArgs]
                const cmdOptions = everything.pop();
                if (Array.isArray(cmdOptions)) {
                    return rejectExtraArgs(program, cmdName, cmdOptions);
                }
                const args = everything;
                const options = {
                    ...program.opts(),
                    ...cmdOptions,
                };

                if (opts.cliOnly) {
                    logger.debug('Executing CLI only script');
                    return loadCommand(cmdName)(args, options, env);
                }
                const namespace = opts.blueprint ? `${packageNameToNamespace(opts.blueprint)}:${cmdName}` : `${JHIPSTER_NS}:${cmdName}`;
                const command = getCommand(namespace, args, opts);
                logger.debug(`Executing generator ${command} with options ${JSON.stringify(options)}`);
                return env.run(command, options).then(done, done);
            });
    });
};

const buildJHipster = ({
    program = createProgram(),
    envBuilder = EnvironmentBuilder.createDefaultBuilder(),
    commands = { ...SUB_GENERATORS, ...envBuilder.getBlueprintCommands() },
    env = envBuilder.getEnvironment(),
    /* eslint-disable-next-line global-require, import/no-dynamic-require */
    loadCommand = key => require(`./${key}`),
} = {}) => {
    /* setup debugging */
    logger.init(program);

    buildCommands({ program, commands, envBuilder, env, loadCommand });

    return program;
};

const runJHipster = (args = {}) => {
    const { argv = process.argv } = args;
    return buildJHipster(args).parseAsync(argv);
};

module.exports = {
    createProgram,
    buildCommands,
    buildJHipster,
    runJHipster,
};
