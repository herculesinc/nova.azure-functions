import * as chai from 'chai';
import * as sinon from 'sinon';

import {
    CorsOptions,
    HttpControllerConfig,
    HttpEndpointDefaults,
    HttpInputMutatorResult,
    HttpRouteConfig,
    HttpRouterConfig
} from '@nova/azure-functions';
import {
    AzureFunctionContext,
    AzureHttpRequest,
    HttpMethod
} from 'azure-functions';
import { defaults } from '../lib/defaults';
import { HttpController, symbols } from '../index';
import { AzureFuncContext, AzureHttpReq, mockAdapter } from './mocks';

const expect = chai.expect;

const toStringFn = () => 'function';
const functionName = 'test';

const SUPPORTED_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

describe('NOVA.AZURE-FUNCTIONS -> \'HttpController\' tests;', () => {
    let result: any;
    let error: any;

    afterEach(() => {
        result = error = undefined;
    });

    describe('Creating an \'HttpController\';', () => {
        it('should create new HttpController with default options', () => {
            const controller = new HttpController();

            expect(controller).to.not.be.undefined;

            expect((controller as any).router).to.not.be.undefined;
            expect((controller as any).rethrowThreshold).to.equal(defaults.httpController.rethrowThreshold);

            expect((controller as any).adapter).to.equal(defaults.httpController.adapter);

            expect((controller as any).defaults).to.not.equal(defaults.httpController.defaults);
            expect((controller as any).defaults).to.deep.equal(defaults.httpController.defaults);
            expect((controller as any).defaults.cors).to.not.equal(defaults.httpController.defaults.cors);

            expect((controller as any).segments).to.not.be.undefined;
            expect((controller as any).segments.size).to.equal(0);
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
                maxParamLength     : true,
                allowUnsafeRegex   : true
            };
            const options: Partial<HttpControllerConfig> = {
                routerOptions
            };

            const controller = new HttpController(options);

            Object.keys(routerOptions).forEach(key => {
                expect((controller as any).router[key]).to.equal(routerOptions[key]);
            });
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

        const route = '/test';

        describe('should register new route for method', () => {
            beforeEach(() => {
                controller = new HttpController();
                action = function(): Promise<any> {return Promise.resolve()}
            });

            SUPPORTED_METHODS.forEach(method => {
                it(method, () => {
                    const config: HttpRouteConfig = {
                        [method.toLowerCase()]: { action }
                    };

                    expect(() => controller.set(route, config)).to.not.throw();
                });
            });
        });

        describe('should not register new route and return error', () => {
            beforeEach(() => {
                controller = new HttpController();
                action = function(): Promise<any> {return Promise.resolve()}
            });

            describe('for unsupported method', () => {
                ['OPTION', 'TEST'].forEach(method => {
                    it(method, () => {
                        expect(() => controller.set(route, {[method.toLowerCase()]: {action}} as HttpRouteConfig)).to.throw(TypeError, `Invalid definition for '${method} ${route}' endpoint: '${method}' method is not supported`);
                    });
                });
            });

            describe('when action/actions is not provided for method', () => {
                SUPPORTED_METHODS.forEach(method => {
                    it(method, () => {
                        expect(() => controller.set(route, {[method.toLowerCase()]: {}} as HttpRouteConfig)).to.throw(TypeError, `Invalid definition for '${method} ${route}' endpoint: no actions were provided`);
                    });
                });
            });

            describe('when route is already registered for method', () => {
                SUPPORTED_METHODS.forEach(method => {
                    it(method.toUpperCase(), () => {
                        const config: HttpRouteConfig = {
                            [method.toLowerCase()]: { action }
                        };

                        expect(() => controller.set(route, config)).to.not.throw();
                        expect(() => controller.set(route, config)).to.throw(TypeError, `Invalid definition for '${route}' endpoint: conflicting endpoint handler found`);
                    });
                });
            });

            describe('when action and actions provided at the same time for method', () => {
                SUPPORTED_METHODS.forEach(method => {
                    it(method, () => {
                        const config: HttpRouteConfig = {
                            [method.toLowerCase()]: {
                                action,
                                actions: [ action ]
                            }
                        };

                        expect(() => controller.set(route, config)).to.throw(TypeError, `Invalid definition for '${method} ${route}' endpoint: 'action' and 'actions' cannot be provided at the same time`);
                    });
                });
            });

            describe('when action and actions provided at the same time for method', () => {
                SUPPORTED_METHODS.forEach(method => {
                    it(method, () => {
                        const config: HttpRouteConfig = {
                            [method.toLowerCase()]: {
                                action: (): Promise<any> => Promise.resolve()
                            }
                        };

                        expect(() => controller.set(route, config)).to.throw(TypeError, `Invalid definition for '${method} ${route}' endpoint: action must be a regular function`);
                    });
                });
            });
        });
    });

    describe('Executing \'HttpController.handler()\' method', () => {
        let controller: HttpController;
        let config: HttpRouteConfig;
        let context: AzureFunctionContext;
        let request: AzureHttpRequest;

        it('should execute handler() method without errors', async () => {
            const actionResult = {test: false};

            try {
                const action = function(): Promise<any> {return Promise.resolve(actionResult)};

                controller = new HttpController();
                config = { get: { action } };
                request = new AzureHttpReq('GET', 'http://test.com');
                context = new AzureFuncContext('id', functionName);

                controller.set('/', config);

                const {status, body} = await controller.handler(context, request );

                expect(status).to.equal(200);
                expect(body).to.deep.equal(actionResult);
            } catch (err) {
                expect(err.message).to.equal('should not have an error');
            }
        });

        describe('passing of data through all handlers (parser -> validator -> authenticator -> mutator -> action -> view);', () => {
            let parserSpy: any;
            let validatorSpy: any;
            let authenticatorSpy: any;
            let mutatorSpy: any;
            let actionSpy: any;
            let viewSpy: any;

            const id = 'params';

            const optDefaults = {
                query : false,
                params: false,
                body  : false
            };
            const requestQuery = {query: 'query'};
            const requestBody = {body: 'body'};
            const headers = {authorization: 'key value'};

            const parserResult = {parser: true};
            const validatorResults = {validator: true};
            const authenticatorResults = {authenticator: true};
            const mutatorResults = {action: {actionMutated: true}, view: {viewMutated: true}};
            const actionResult = {action: true};
            const viewResult = {view: true};

            beforeEach(async () => {
                controller = new HttpController();
                context = new AzureFuncContext('id', functionName);
                request = new AzureHttpReq('GET', `http://test.com/${id}`, headers, requestQuery, requestBody);

                parserSpy = sinon.stub().returns(Promise.resolve(parserResult));
                validatorSpy = sinon.stub().returns(validatorResults);
                authenticatorSpy = sinon.stub().returns(Promise.resolve(authenticatorResults));
                mutatorSpy = sinon.stub().returns(mutatorResults);
                actionSpy = sinon.stub().returns(Promise.resolve(actionResult));
                viewSpy = sinon.stub().returns(viewResult);

                parserSpy.toString = toStringFn;
                validatorSpy.toString = toStringFn;
                authenticatorSpy.toString = toStringFn;
                mutatorSpy.toString = toStringFn;
                actionSpy.toString = toStringFn;
                viewSpy.toString = toStringFn;

                config = {
                    get: {
                        scope   : 'test:scope',
                        options : {},
                        defaults: optDefaults,
                        inputs  : parserSpy,
                        schema  : validatorSpy,
                        auth    : authenticatorSpy,
                        mutator : mutatorSpy,
                        action  : actionSpy,
                        view    : viewSpy
                    }
                };

                controller.set('/:id', config);

                try {
                    result = await controller.handler(context, request );
                } catch (err) {
                    error = err;
                }
            });

            it('should not return an error', () => {
                expect(error).to.be.undefined;
            });

            it('should return correct status', () => {
                expect(result.status).to.equal(200);
            });

            it('should return correct body', () => {
                expect(result.body).to.deep.equal(viewResult);
            });

            describe('parser;', () => {
                it('should be executed once', async () => {
                    expect((parserSpy as any).called).to.be.true;
                    expect((parserSpy as any).callCount).to.equal(1);
                });
                it('should be executed with correct arguments', () => {
                    expect(parserSpy.firstCall.calledWithExactly(request, optDefaults, {id})).to.be.true;
                });
            });

            describe('validator;', () => {
                it('should be executed once', async () => {
                    expect((validatorSpy as any).called).to.be.true;
                    expect((validatorSpy as any).callCount).to.equal(1);
                });
                it('should be executed with correct arguments', () => {
                    expect(validatorSpy.firstCall.calledWithExactly(parserResult)).to.be.true;
                });
            });

            describe('authenticator;', () => {
                it('should be executed once', async () => {
                    expect((authenticatorSpy as any).called).to.be.true;
                    expect((authenticatorSpy as any).callCount).to.equal(1);
                });
                it('should be executed with correct arguments', () => {
                    expect(authenticatorSpy.firstCall.calledWithExactly(config.get.scope, {type: 'key', data: 'value'})).to.be.true;
                });
            });

            describe('mutator;', () => {
                it('should be executed once', async () => {
                    expect((mutatorSpy as any).called).to.be.true;
                    expect((mutatorSpy as any).callCount).to.equal(1);
                });
                it('should be executed with correct arguments', () => {
                    expect(mutatorSpy.firstCall.calledWithExactly(validatorResults, authenticatorResults)).to.be.true;
                });
            });

            describe('action;', () => {
                it('should be executed once', async () => {
                    expect((actionSpy as any).called).to.be.true;
                    expect((actionSpy as any).callCount).to.equal(1);
                });
                it('should be executed with correct arguments', () => {
                    expect(actionSpy.firstCall.calledWithExactly(mutatorResults.action)).to.be.true;
                });
            });

            describe('view;', () => {
                it('should be executed once', async () => {
                    expect((viewSpy as any).called).to.be.true;
                    expect((viewSpy as any).callCount).to.equal(1);
                });
                it('should be executed with correct arguments', () => {
                    expect(viewSpy.firstCall.calledWithExactly(actionResult, mutatorResults.view)).to.be.true;
                });
            });
        });

        describe('passing of data through all handlers (action -> view);', () => {
            let actionSpy: any;
            let viewSpy: any;

            const id = 'params';

            const optDefaults = {
                query : false,
                params: false,
                body  : false
            };
            const requestQuery = {query: 'query'};
            const requestBody = {body: 'body'};

            const actionResult = {action: true};
            const viewResult = {view: true};

            const actionInputs = {...optDefaults, ...requestQuery, id, ...requestBody};

            beforeEach(async () => {
                controller = new HttpController();
                context = new AzureFuncContext('id', functionName);
                request = new AzureHttpReq('GET', `http://test.com/${id}`, null, requestQuery, requestBody);

                actionSpy = sinon.stub().returns(Promise.resolve(actionResult));
                viewSpy = sinon.stub().returns(viewResult);

                actionSpy.toString = toStringFn;
                viewSpy.toString = toStringFn;

                config = {
                    get: {
                        defaults: optDefaults,
                        action  : actionSpy,
                        view    : viewSpy
                    }
                };

                controller.set('/:id', config);

                try {
                    result = await controller.handler(context, request );
                } catch (err) {
                    error = err;
                }
            });

            it('should not return an error', () => {
                expect(error).to.be.undefined;
            });

            it('should return correct status', () => {
                expect(result.status).to.equal(200);
            });

            it('should return correct body', () => {
                expect(result.body).to.deep.equal(viewResult);
            });

            describe('action;', () => {
                it('should be executed once', async () => {
                    expect((actionSpy as any).called).to.be.true;
                    expect((actionSpy as any).callCount).to.equal(1);
                });
                it('should be executed with correct arguments', () => {
                    expect(actionSpy.firstCall.calledWithExactly(actionInputs)).to.be.true;
                });
            });

            describe('view;', () => {
                it('should be executed once', async () => {
                    expect((viewSpy as any).called).to.be.true;
                    expect((viewSpy as any).callCount).to.equal(1);
                });
                it('should be executed with correct arguments', () => {
                    expect(viewSpy.firstCall.calledWithExactly(actionResult, undefined)).to.be.true;
                });
            });
        });

        describe('passing of data through all handlers (action);', () => {
            let actionSpy: any;

            const id = 'params';

            const optDefaults = {
                query : false,
                params: false,
                body  : false
            };
            const requestQuery = {query: 'query'};
            const requestBody = {body: 'body'};

            const actionResult = {action: true};

            const actionInputs = {...optDefaults, ...requestQuery, id, ...requestBody};

            beforeEach(async () => {
                controller = new HttpController();
                context = new AzureFuncContext('id', functionName);
                request = new AzureHttpReq('GET', `http://test.com/${id}`, null, requestQuery, requestBody);

                actionSpy = sinon.stub();

                actionSpy.toString = toStringFn;

                config = {
                    get: {
                        defaults: optDefaults,
                        action  : actionSpy
                    }
                };

                controller.set('/:id', config);

                try {
                    result = await controller.handler(context, request );
                } catch (err) {
                    error = err;
                }
            });

            it('should not return an error', () => {
                expect(error).to.be.undefined;
            });

            it('should return correct status', () => {
                expect(result.status).to.equal(404);
            });

            it('should return correct body', () => {
                expect(result.body).to.equal(null);
            });

            describe('action;', () => {
                it('should be executed once', async () => {
                    expect((actionSpy as any).called).to.be.true;
                    expect((actionSpy as any).callCount).to.equal(1);
                });
                it('should be executed with correct arguments', () => {
                    expect(actionSpy.firstCall.calledWithExactly(actionInputs)).to.be.true;
                });
            });
        });

        describe('when action and view return no results for method', () => {
            let actionSpy: any;

            beforeEach(async () => {
                controller = new HttpController();
                context = new AzureFuncContext('id', functionName);

                actionSpy = sinon.stub();

                actionSpy.toString = toStringFn;
            });

            SUPPORTED_METHODS.forEach(method => {
                const status = method === 'GET' ? 404 : 204;

                describe(method, () => {
                    beforeEach(async () => {
                        request = new AzureHttpReq(method, 'http://test.com');

                        config = {
                            [method.toLowerCase()]: {
                                action: actionSpy
                            }
                        };

                        controller.set('/', config);

                        try {
                            result = await controller.handler(context, request );
                        } catch (err) {
                            error = err;
                        }
                    });

                    it('should not return an error', () => {
                        expect(error).to.be.undefined;
                    });
                    it(`should return status '${status}'`, () => {
                        expect(result.status).to.equal(status);
                    });
                    it('should return correct body', () => {
                        expect(result.body).to.equal(null);
                    });
                });
            });
        });

        describe('parsing route parameters;', () => {
            let actionSpy: any;

            const actionInputs = {id: '12345', ID: 'abcde'};

            beforeEach(async () => {
                controller = new HttpController();
                context = new AzureFuncContext('id', functionName);
                request = new AzureHttpReq('GET', `http://test.com/${actionInputs.id}/participants/${actionInputs.ID}`);

                actionSpy = sinon.stub();

                actionSpy.toString = toStringFn;

                config = {
                    get: {
                        action: actionSpy
                    }
                };

                controller.set('/:id/participants/:ID', config);

                try {
                    result = await controller.handler(context, request );
                } catch (err) {
                    err = error;
                }
            });

            it('should not return an error', () => {
                expect(error).to.be.undefined;
            });

            it('should return correct status', () => {
                expect(result.status).to.equal(404);
            });

            it('should return correct body', () => {
                expect(result.body).to.equal(null);
            });

            it('action should be executed with route params', () => {
                expect(actionSpy.firstCall.calledWithExactly(actionInputs)).to.be.true;
            });
        });

        describe('view with symbols;', () => {
            let actionSpy: any;
            let viewSpy: any;

            const status = 255;
            const headers = {foo: 'bar', bar: 'baz'};
            const viewResult = {bar: 'baz'};

            beforeEach(async () => {
                controller = new HttpController();
                context = new AzureFuncContext('id', functionName);
                request = new AzureHttpReq('GET', 'http://test.com');

                actionSpy = sinon.stub();
                viewSpy = sinon.stub().returns({
                    [symbols.responseStatus]: status,
                    [symbols.responseHeaders]: headers,
                    ...viewResult
                });

                actionSpy.toString = toStringFn;
                viewSpy.toString = toStringFn;

                config = {
                    get: {
                        action: actionSpy,
                        view  : viewSpy
                    }
                };

                controller.set('/', config);

                try {
                    result = await controller.handler(context, request );
                } catch (err) {
                    error = err;
                }
            });

            it('should not return an error', () => {
                expect(error).to.be.undefined;
            });

            it('should return correct status', () => {
                expect(result.status).to.equal(status);
            });

            it('should return correct headers', () => {
                Object.keys(headers).forEach(key => {
                    expect(result.headers).to.have.property(key, headers[key]);
                });
            });

            it('should return correct body', () => {
                expect(result.body).to.deep.equal(viewResult);
            });
        });
    });

    describe('Error handling of \'HttpController.handler()\' method', () => {
        let controller: HttpController;
        let config: HttpRouteConfig;
        let context: AzureFunctionContext;
        let request: AzureHttpRequest;

        describe('exception in action;', () => {
            let actionSpy: any;

            beforeEach(async () => {
                controller = new HttpController();
                context = new AzureFuncContext('id', functionName);
                request = new AzureHttpReq('GET', 'http://test.com');

                actionSpy = sinon.stub().throws('Error', 'message');

                actionSpy.toString = toStringFn;

                config = {
                    get: {
                        action: actionSpy
                    }
                };

                controller.set('/', config);

                try {
                    result = await controller.handler(context, request );
                } catch (err) {
                    error = err;
                }
            });

            it('should not return an error', () => {
                expect(error).to.be.undefined;
            });

            it('should return correct status', () => {
                expect(result.status).to.equal(500);
            });

            it('should return correct body', () => {
                expect(result.body).to.deep.equal({name: 'Error', message: 'message'});
            });
        });

        describe('for rejected action;', () => {
            let actionSpy: any;

            beforeEach(async () => {
                controller = new HttpController();
                context = new AzureFuncContext('id', functionName);
                request = new AzureHttpReq('GET', 'http://test.com');

                actionSpy = sinon.stub().returns(Promise.reject(new Error('message')));

                actionSpy.toString = toStringFn;

                config = {
                    get: {
                        action: actionSpy
                    }
                };

                controller.set('/', config);

                try {
                    result = await controller.handler(context, request );
                } catch (err) {
                    error = err;
                }
            });

            it('should not return an error', () => {
                expect(error).to.be.undefined;
            });

            it('should return correct status', () => {
                expect(result.status).to.equal(500);
            });

            it('should return correct body', () => {
                expect(result.body).to.deep.equal({name: 'Error', message: 'message'});
            });
        });

        describe('with rethrowThreshold = 499 and error status 500;', () => {
            let actionSpy: any;

            beforeEach(async () => {
                controller = new HttpController({rethrowThreshold: 499});
                context = new AzureFuncContext('id', functionName);
                request = new AzureHttpReq('GET', 'http://test.com');

                actionSpy = sinon.stub().throws('Error', 'message');

                actionSpy.toString = toStringFn;

                config = {
                    get: {
                        action: actionSpy
                    }
                };

                controller.set('/', config);

                try {
                    result = await controller.handler(context, request );
                } catch (err) {
                    error = err;
                }
            });

            it('should throw exception', () => {
                expect(result).to.be.undefined;
                expect(error).to.not.be.undefined;
            });
        });

        describe('with rethrowThreshold = 499 and error status 404;', () => {
            let actionSpy: any;

            beforeEach(async () => {
                controller = new HttpController({rethrowThreshold: 499});
                context = new AzureFuncContext('id', functionName);
                request = new AzureHttpReq('GET', 'http://test.com');

                actionSpy = sinon.stub().throws({status: 404, name: 'Error', message: 'message'});

                actionSpy.toString = toStringFn;

                config = {
                    get: {
                        action: actionSpy
                    }
                };

                controller.set('/', config);

                try {
                    result = await controller.handler(context, request );
                } catch (err) {
                    error = err;
                }
            });

            it('should not return an error', () => {
                expect(error).to.be.undefined;
            });

            it('should return correct status', () => {
                expect(result.status).to.equal(404);
            });

            it('should return correct body', () => {
                expect(result.body).to.deep.equal({name: 'Error', message: 'message'});
            });
        });
    });
});
