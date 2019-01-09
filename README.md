# Nova Functions
Web API framework for Azure Functions written in TypeScript.

## Install

```sh
$ npm install --save nova-functions
```

## Examples

index.js
```JavaScript
const nova = require('nova-functions');
const controller = new nova.HttpController();

controller.set('HttpTrigger', '/', {
    get: {
        action: (inputs, context) => {
            context.log.info('Some debug message');
            return {
                message: `Hello ${inputs.name}!`
            };
        }
    },
    post: {
        action: (inputs, context) => {
            context.log.info('Some other debug message');
            const userId = inputs.userId;
            // make some updates here
        }
    }
});

module.exports = controller;
```

function.json
```JSON
{
  "disabled": false,
  "entryPoint": "handler",
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "request",
      "route": "HttpTrigger/{*route}"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "$return"
    }
  ]
}

```


## License
Copyright (c) 2018 Credo360, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.