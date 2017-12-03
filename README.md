# dynloader

This is a proof of concept implementation of a new module loader for the browser. This loader is inspired by work that I did at Rdio a few years ago, and Laurie Voss' Nodevember 2017 keynote.

I'd love for you to take a look and let me know what you think by filing an issue! Be sure to check out the example project for a more in depth look.

## Design Goals

This loader has the following design goals:

- Dynamic loading
    - The ability to programatically load dependencies on-demand.
    - Ex. an SPA wants to load the dependencies for a single route only when it's selected, but not the dependencies for the other routes. Future routes should be loaded only when the user requests to navigate to that route.
- Bundling dependencies for transport
- Lazy loaded dependencies
    - Dependencies split into two sets.
    - Load dependencies must be evaluated before evaluating the module like in ES6 modules and Require.js)
    - Lazy dependencies are not fetched until after module evaluation is complete
- No Code Compilation
    - Build tools should be optional to the furthest extent possible, babel should not be required
- No user-defined manifests or configurations
    - No need for package.json (unless using npm modules), or any other configuration files
- Support for CommonJS modules installed via npm

These goals were largely inspired by the needs of the Rdio web client, a very large single page web app. The codebase was large enough that it was very slow to bundle all scripts for the entire site. Webpack offers code-splitting, but it's difficult to manage and offers no mechanisms for loading the different sets of scripts.

## Module definition spec

Modules are defined using ES5 compatible JavaScript syntax. This does _not_ use ES6 module syntax (for now?). A module is defined using:

```JavaScript
dyn.register({
  name: 'myModule',
  loadDependencies: [ 'myLoadDep' ],
  lazyDependencies: [ 'myLazyDep', 'lodash' ],
  onLoad(err, { myLoadDep }, onBackgroundLoad) {
    console.log(myLoadDep);
    onBackgroundLoad((err, { myLazyDep, lodash: _ }) => {
      console.log(_.forIn(myLazyDep, (value, key) => console.log(value, key)));
    });
    return {
      run() {
        console.log('running');
      }
    }
  }
});
```

## On Demand Loading

Using the example from the previous section, we can load `myModule` with the following code:

```JavaScript
load('myModule', (err, { myModule }) => {
  console.log(myModule.run()); // prints "running"
})
```

Since this is a normal JavaScript function, it can be loaded from anywhere in code, including insite of conditional statements.

## Initialization

The trick to getting this system to work is by running a small and fast tool over a project's source code and creating a dependency map of the entire project. Note that this is _not_ a complete dependency tree. This dependency map is shipped to the client, which it then uses to do smart loading of dependencies and to know how to bundle dependencies.

The example project uses a handlebars template to [initialize the loader](blob/master/templates/index.handlebars#L8), with the following line:

```JavaScript
dyn.init({{{moduleInfo}}});
```

This prototype creates the map during [server startup](blob/master/server/src/server.ts#L9).

## Possible Features

This specification was designed specifically to enable a lot of other cool features, including:

- Service Works and Local Storage for caching dependencies in the background
- Tracking app build versions, and downloading code patches instead of full files if older versions are already cached (think `git diff`) to decrease download time even more
- Auto-swap caching strategies to optimize for HTTP vs HTTP/2 depending on combination of browser and server capabilities
- Compiling ES6-module based code into this format for backwards compatibility
- Intermediate/transport specifications so there can be multiple client and server implementations supporting this spec
- Conditional loading on the server of module code, e.g. serving optimized builds for modern browsers and serving non-optimized-but-backwards-compatible builds for older browsers.

## FAQ

**Is there a server component?**

Yes. All client code is served by a server at the end of the day. Using a loader-specific server instead of a generic file server enables me to optimize the loading process to a much higher degree (see Possible Features above).

If this gets out of the prototype phase, I would like to define a transport protocol so that there can be multiple server implementations that integrate into different server frameworks and/or langauges. I could definitely see this being an express plugin, for example.

**Isn't the dependency map generation a build step? What about your no build step requirement?**

Technically speaking this doesn't do any code transformation, because bundling happens on the fly and a map is just metadata. Nonetheless, there is still a tool that needs to be run.

Currently the tool is integrated into the server. I took this approach just to get things up and running quickly, but ultimately I could see this being a standalone tool that can be integrated into other workflows, and could contain things like file watching and incremental "building."

**This sure looks a lot like require.js**

That's not a question.

**Fiiiine. Why does this look like require.js?**

I wanted something familiar-ish looking to get bootstrapped quickly and I didn't want to spend a lot of time bike-shedding on the specification. I'm quite open to changing this syntax.

# License

MIT License

Copyright (c) 2017 Bryan Hughes

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
