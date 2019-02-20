import { expect } from 'chai';
import * as sinon from 'sinon';

import { HttpController } from '../index';
import { HttpSegment } from '../lib/HttpSegment';
import {
    Authenticator,
    Credentials,
    HttpEndpointDefaults,
    HttpInputMutator,
    HttpInputMutatorResult, HttpRouteConfig, ViewBuilder,
    ViewContext
} from '@nova/azure-functions';
import { Context } from '@nova/core';
import { HttpMethod } from "azure-functions";

const SUPPORTED_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const routeSegment = '/test';

describe('NOVA.AZURE-FUNCTIONS -> \'HttpSegment\' tests;', () => {
    let controller: HttpController;
    let segment: HttpSegment;
    let action: any;
    let result: any;
    let error: any;

    beforeEach(() => {
        controller = new HttpController();
        action = function(): Promise<any> {return Promise.resolve()}
    });

    afterEach(() => {
        controller = segment = action = undefined;
        result = error = undefined;
    });

    describe('Creating an \'HttpSegment\';', () => {
        it('should create new HttpSegment with default options', () => {
            segment = new HttpSegment(controller, routeSegment);

            expect(segment).to.not.be.undefined;

            expect((segment as any).controller).to.equal(controller);
            expect((segment as any).root).to.equal(routeSegment);
            expect((segment as any).defaults).to.be.undefined;
        });

        it('should provide custom options to new segment', () => {
            const defaults: HttpEndpointDefaults = {
                cors   : {
                    origin     : 'origin',
                    headers    : ['headers'],
                    credentials: 'credentials',
                    maxAge     : 'maxAge'
                },
                scope  : 'test:scope',
                auth   : function(this: Context, scope: string, credentials: Credentials): Promise<any> {return Promise.resolve(true)},
                mutator: function(this: Context, inputs: any, auth?: any): HttpInputMutatorResult {return {}},
                view   : function(this: ViewContext, result: any, options?: any): any {return null}
            };

            segment = new HttpSegment(controller, routeSegment, defaults);

            expect(segment).to.not.be.undefined;

            expect((segment as any).defaults).to.not.be.undefined;

            expect((segment as any).defaults.cors).to.not.equal(defaults.cors);
            expect((segment as any).defaults.cors).to.deep.equal(defaults.cors);

            expect((segment as any).defaults.scope).to.equal(defaults.scope);
            expect((segment as any).defaults.auth).to.equal(defaults.auth);
            expect((segment as any).defaults.mutator).to.equal(defaults.mutator);
            expect((segment as any).defaults.view).to.equal(defaults.view);
        });

        it('should throw exception if auth is an arrow function', () => {
            const defaults: HttpEndpointDefaults = {
                auth: (async () => {}) as Authenticator
            };

            expect(() => new HttpSegment(controller, routeSegment, defaults)).to.throw(TypeError, 'test');
        });

        it('should throw exception if mutator is an arrow function', () => {
            const defaults: HttpEndpointDefaults = {
                mutator: (() => ({})) as HttpInputMutator
            };

            expect(() => new HttpSegment(controller, routeSegment, defaults)).to.throw(TypeError, 'test');
        });

        it('should throw exception if view is an arrow function', () => {
            const defaults: HttpEndpointDefaults = {
                view: (() => ({})) as ViewBuilder
            };

            expect(() => new HttpSegment(controller, routeSegment, defaults)).to.throw(TypeError, 'test');
        });
    });

    describe('Executing \'HttpSegment.set()\' method', () => {
        const subroute = '/route';
        const fullRoute = routeSegment + subroute;

        beforeEach(() => {
            segment = new HttpSegment(controller, routeSegment);
        });

        describe('should register new subroute for method', () => {
            SUPPORTED_METHODS.forEach(method => {
                it(method, () => {
                    const config: HttpRouteConfig = {
                        [method.toLowerCase()]: { action }
                    };

                    expect(() => segment.set(subroute, config)).to.not.throw();
                });
            });
        });

        describe('should not register new subroute and return error', () => {
            describe('for unsupported method', () => {
                ['OPTION', 'TEST'].forEach(method => {
                    it(method, () => {
                        expect(() => segment.set(subroute, {[method.toLowerCase()]: {action}} as HttpRouteConfig)).to.throw(TypeError, `Invalid definition for '${method} ${fullRoute}' endpoint: '${method}' method is not supported`);
                    });
                });
            });

            describe('when action/actions is not provided for method', () => {
                SUPPORTED_METHODS.forEach(method => {
                    it(method, () => {
                        expect(() => segment.set(subroute, {[method.toLowerCase()]: {}} as HttpRouteConfig)).to.throw(TypeError, `Invalid definition for '${method} ${fullRoute}' endpoint: no actions were provided`);
                    });
                });
            });

            describe('when route is already registered for method', () => {
                SUPPORTED_METHODS.forEach(method => {
                    it(method.toUpperCase(), () => {
                        const config: HttpRouteConfig = {
                            [method.toLowerCase()]: { action }
                        };

                        expect(() => segment.set(subroute, config)).to.not.throw();
                        expect(() => segment.set(subroute, config)).to.throw(TypeError, `Invalid definition for '${fullRoute}' endpoint: conflicting endpoint handler found`);
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

                        expect(() => segment.set(subroute, config)).to.throw(TypeError, `Invalid definition for '${method} ${fullRoute}' endpoint: 'action' and 'actions' cannot be provided at the same time`);
                    });
                });
            });

            describe('when action provided as arrow function', () => {
                SUPPORTED_METHODS.forEach(method => {
                    it(method, () => {
                        const config: HttpRouteConfig = {
                            [method.toLowerCase()]: {
                                action: (): Promise<any> => Promise.resolve()
                            }
                        };

                        expect(() => segment.set(subroute, config)).to.throw(TypeError, `Invalid definition for '${method} ${fullRoute}' endpoint: action must be a regular function`);
                    });
                });
            });
        });
    });
});
