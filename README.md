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

The example project uses a handlebars template to [initialize the loader](templates/index.handlebars#L8), with the following line:

```JavaScript
dyn.init({{{moduleInfo}}});
```

This prototype creates the map during [server startup](server/src/server.ts#L9).

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

I wanted something familiar-ish looking to get bootstrapped quickly and I didn't want to spend a lot of time bike-shedding on the specification. I'm _very_ open to changing this syntax.

**Can you use ES2015 modules or CommonJS syntax instead? Why the new format?**

Both formats have pros and cons, and ironically the pros of one are what the other lacks typically. CommonJS is simple and easy to understand, also allows for dynamic and/or lazy loading, and does not require a compile step. ES2015 modules do not allow for dynamic/lazy loading, are a bit more complex, and require a compilation step in practice, but they are statically analyzable. This means tooling around ES6 modules is _much_ more intelligent.

I'm trying to have my cake and eat it too: statically analyzable modules, along with the optimizations that come along with it, combined with the ease of us of CommonJS and the ability to do lazy/conditional loading. Also, no compilation step.

I also want to implement tools that will compile code written for CommonJS and ES2015 Modules into my format so that they can both be backwards compatible (probably with some edge cases). This way, you can choose to use wichever syntax you prefer while still being able to take advantage of the extra features I provide.

**How do I integrate this into my server?**

Stay tuned! Everything is so prototype-y that there are no separable interfaces yet. I hope to fix this soon though and provide a couple of modules (published to npm of course) that provide all of the server and client components necessary in an easy to use package.

**Is this a replacement for webpack/Browserify?**

It depends on what you're using webpack/Browserify for, but I would say "no" for most use cases. Webpack and Browserify offer a _lot_ of functionality, and can be used for a lot of things. My view is that these systems are first and foremost _compilation_ and _bundling_ tools. While they both include a module loader, that is only a tiny fraction of what these tools can do.

This system is a module loader _only_, by design. I do not think that compilation or other sorts of asset transformation belong in this system. My vision is a future where webpack and Browserify are still the build tools used by web devs, and they compile to this format.

In other words, I think these tools and this system are complimentary, not competitive.

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
