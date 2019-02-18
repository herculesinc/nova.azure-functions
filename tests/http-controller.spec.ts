import * as chai from 'chai';
import * as sinon from 'sinon';

import {
    Authenticator,
    CorsOptions,
    HttpControllerConfig,
    HttpEndpointDefaults, HttpInputMutator,
    HttpInputMutatorResult, HttpInputParser, HttpInputValidator,
    HttpRouteConfig,
    HttpRouterConfig, ViewBuilder
} from '@nova/azure-functions';
import {
    AzureExecutionContext,
    AzureFunctionContext,
    AzureFunctionLogger,
    AzureHttpRequest,
    AzureHttpResponse
} from 'azure-functions';
import { defaults } from '../lib/defaults';
import { HttpController } from '../index';
import { mockAdapter } from './mocks';

const expect = chai.expect;

describe('NOVA.AZURE-FUNCTIONS -> \'HttpController\' tests;', () => {
    describe('Creating an \'HttpController\';', () => {
        it('should create new HttpController with default options', () => {
            const controller = new HttpController();

            expect(controller).to.not.be.undefined;

            expect((controller as any).routers).to.not.be.undefined;
            expect((controller as any).routers.size).to.equal(0);

            expect((controller as any).routerOptions).to.be.undefined;

            expect((controller as any).rethrowThreshold).to.equal(defaults.httpController.rethrowThreshold);

            expect((controller as any).adapter).to.equal(defaults.httpController.adapter);

            expect((controller as any).defaults).to.not.equal(defaults.httpController.defaults);
            expect((controller as any).defaults).to.deep.equal(defaults.httpController.defaults);
            expect((controller as any).defaults.cors).to.not.equal(defaults.httpController.defaults.cors);
        });

        it('should provide custom adapter to new controller', () => {
            const options: Partial<HttpControllerConfig> = {
                adapter: mockAdapter
            };

            const controller = new HttpController(options);

            expect((controller as any).adapter).to.equal(mockAdapter);
            expect((controller as any).adapter).to.not.equal(defaults.httpController.adapter);
        });

        it('should provide custom routerOptions to new controller', () => {
            const routerOptions: HttpRouterConfig = {
                ignoreTrailingSlash: true,
                maxParamLength     : false,
                allowUnsafeRegex   : true
            };
            const options: Partial<HttpControllerConfig> = {
                routerOptions
            };

            const controller = new HttpController(options);

            expect((controller as any).routerOptions).to.not.be.undefined;
            expect((controller as any).routerOptions).to.equal(routerOptions);
        });

        it('should provide custom rethrowThreshold to new controller', () => {
            const rethrowThreshold = 1000;

            const controller = new HttpController({rethrowThreshold});

            expect((controller as any).rethrowThreshold).to.not.equal(defaults.httpController.rethrowThreshold);
            expect((controller as any).rethrowThreshold).to.equal(rethrowThreshold);
        });

        it('should provide custom defaults to new controller', () => {
            const cors = {
                origin: 'origin'
            } as CorsOptions;

            const defaultsOptions: HttpEndpointDefaults = {
                scope  : 'scope',
                cors   : cors,
                auth   : (): Promise<any> => (Promise.resolve()),
                mutator: (): HttpInputMutatorResult => ({}),
                view   : (): void => undefined
            };

            const controller = new HttpController({defaults: defaultsOptions});

            // scope
            expect((controller as any).defaults.scope).to.not.equal(defaults.httpController.defaults.scope);
            expect((controller as any).defaults.scope).to.equal(defaultsOptions.scope);

            // cors
            expect((controller as any).defaults.cors).to.not.deep.equal(defaults.httpController.defaults.cors);
            expect((controller as any).defaults.cors).to.not.deep.equal(defaultsOptions.cors);

            Object.keys((controller as any).defaults.cors).forEach(key => {
                if (typeof cors[key] !== 'undefined') {
                    expect((controller as any).defaults.cors[key]).to.equal(cors[key]);
                } else {
                    expect((controller as any).defaults.cors[key]).to.equal(defaults.httpController.defaults.cors[key]);
                }
            });

            // view
            expect((controller as any).defaults.view).to.equal(defaultsOptions.view);
            expect((controller as any).defaults.view).to.not.equal(defaults.httpController.defaults.view);

            // other
            expect((controller as any).defaults.auth).to.equal(defaultsOptions.auth);
            expect((controller as any).defaults.mutator).to.equal(defaultsOptions.mutator);
        });
    });

    describe('Executing \'HttpController.set()\' method', () => {
        let controller: HttpController;
        let action: any;

        describe('should register new route', () => {
            beforeEach(() => {
                controller = new HttpController();
                action = function(): Promise<any> {return Promise.resolve()}
            });

            ['get', 'post', 'put', 'patch', 'delete'].forEach(method => {
                it(`for method '${method.toUpperCase()}'`, () => {
                    const config: HttpRouteConfig = {
                        [method]: { action }
                    };

                    expect(() => controller.set('test', '/', config)).to.not.throw();
                });
            });
        });

        describe('should not register new route and return error', () => {
            beforeEach(() => {
                controller = new HttpController();
                action = function(): Promise<any> {return Promise.resolve()}
            });

            describe('for unsupported method', () => {
                ['option', 'test'].forEach(method => {
                    it(method.toUpperCase(), () => {
                        expect(() => controller.set('test', '/', {[method]: {action}} as HttpRouteConfig)).to.throw(TypeError, 'error message');
                    });
                });
            });

            describe('when action/actions is not provided for method', () => {
                ['get', 'post', 'put', 'patch', 'delete'].forEach(method => {
                    it(method.toUpperCase(), () => {
                        expect(() => controller.set('test', '/', {[method]: {}} as HttpRouteConfig)).to.throw(TypeError, 'error message');
                    });
                });
            });

            describe('when route is already registered for method', () => {
                ['get', 'post', 'put', 'patch', 'delete'].forEach(method => {
                    it(method.toUpperCase(), () => {
                        const config: HttpRouteConfig = {
                            [method]: { action }
                        };

                        expect(() => controller.set('test', '/', config)).to.not.throw();
                        expect(() => controller.set('test', '/', config)).to.throw(TypeError, `Method '${method.toUpperCase()}' already declared for route '/'`);
                    });
                });
            });

            describe('when action and actions provided at the same time for method', () => {
                ['get', 'post', 'put', 'patch', 'delete'].forEach(method => {
                    it(method.toUpperCase(), () => {
                        const config: HttpRouteConfig = {
                            [method]: {
                                action,
                                actions: [ action ]
                            }
                        };

                        expect(() => controller.set('test', '/', config)).to.throw(TypeError, `Invalid definition for '${method.toUpperCase()} /' endpoint: 'action' and 'actions' cannot be provided at the same time`);
                    });
                });
            });

            describe('when action and actions provided at the same time for method', () => {
                ['get', 'post', 'put', 'patch', 'delete'].forEach(method => {
                    it(method.toUpperCase(), () => {
                        const config: HttpRouteConfig = {
                            [method]: {
                                action: (): Promise<any> => Promise.resolve()
                            }
                        };

                        expect(() => controller.set('test', '/', config)).to.throw(TypeError, `Invalid definition for '${method.toUpperCase()} /' endpoint: action must be a regular function`);
                    });
                });
            });
        });
    });

    describe('Executing \'HttpController.handler()\' method', () => {
        let controller: HttpController;
        let config: HttpRouteConfig;
        let action: any;
        let context: AzureFunctionContext;
        let request: AzureHttpRequest;

        const functionName = 'test';

        beforeEach(() => {
            action = function(): Promise<any> {return Promise.resolve({test: false})};
            controller = new HttpController();

            config = { get: { action } };

            controller.set(functionName, '/', config);

            const logger = function(message: string) {

            };

            (logger as any).verbose = () => {};
            (logger as any).info = () => {};
            (logger as any).error = () => {};
            (logger as any).warn = () => {};

            context = {
                invocationId      : 'invocationId',
                executionContext  : {
                    invocationId     : 'invocationId',
                    functionName     : functionName,
                    functionDirectory: 'functionDirectory'
                },
                bindingDefinitions: [],
                bindings          : {},
                log               : logger as AzureFunctionLogger,
                done              : (error?: Error, response?: AzureHttpResponse): void => undefined
            };

            request = {
                method     : 'GET',
                url        : 'http://test.com',
                originalUrl: 'http://test.com',
                headers    : {'content-type': 'application/json'},
                query      : {foo: 'bar'},
                params     : {route: ''},
                body       : {}
            };
        });

        it('should ', async () => {
            try {
                const result = await controller.handler(context, request );

                console.log(result)
            } catch (err) {
                expect(err.message).to.equal('exception');
            }
        });

        // request -> inputs -> chain -> result;
        // defaults.value -> inputs -> results;
        // auth header -> parser;

        /*
        scope?      : string; -> auth
        options?    : any; -> adapter
        defaults?   : any; -> inputs or schema
        inputs?     : HttpInputParser;
        schema?     : HttpInputValidator; ->
        auth?       : Authenticator;
        mutator?    : HttpInputMutator;
        action?     : Action;
        actions?    : Action[];
        view?       : ViewBuilder;
        */
    });
});
