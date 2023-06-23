(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.singleSpa = {}));
})(this, (function (exports) { 'use strict';

    // 描述应用的整个状态

    const NOT_LOADED = 'NOT_LOADED'; // 应用初始状态
    const LOADING_SOURCE_CODE = 'LOADING_SOURCE_CODE'; // 加载资源
    const NOT_BOOTSTRAPPED = 'NOT_BOOTSTRAPPED'; // 还没有调用bootstrap方法
    const BOOTSTRAPPING = 'BOOTSTRAPPING'; // 启动中
    const NOT_MOUNTED = 'NOT_MOUNTED'; // 没有调用mount方法
    const MOUNTING = 'MOUNTING'; // 正在挂载中
    const MOUNTED = 'MOUNTED'; // 挂载完毕
    const UNMOUNTING = 'UNMOUNTING'; // 解除挂载
    const SKIP_BECAUSE_BROKEN = 'SKIP_BECAUSE_BROKEN'; // 代码出错
    // 当前这个应用是否要被激活 
    function shouldBeActive(app) { // 如果返回true 那么应用应该就开始初始化等一系列操作、加载资源...
        return app.activeWhen(window.location);
    }

    async function toBootstrapPromise(app) {
        if(app.status !== NOT_BOOTSTRAPPED) {
            return app;
        }
        app.status = BOOTSTRAPPING;
        await app.bootstrap(app.customProps);
        app.status = NOT_MOUNTED;
        return app;
    }

    function flattenFnArray(fns) {
        fns = Array.isArray(fns) ? fns : [fns];
        return (props) => fns.reduce((p, fn) => p.then(() => fn(props)), Promise.resolve())
    }

    async function toLoadPromise(app) {
        // if(app.status === LOADING_SOURCE_CODE) return app; 是否可以用状态判断
        if(app.loadPromise) {
            return app.loadPromise; // 缓存机制
        }
        return (app.loadPromise = Promise.resolve().then(async () => {
            app.status = LOADING_SOURCE_CODE;
            let { bootstrap, mount, unmount } = await app.loadApp(app.customProps);
            app.status = NOT_BOOTSTRAPPED; // 没有调用bootstrap方法

            app.bootstrap = flattenFnArray(bootstrap);
            app.mount = flattenFnArray(mount);
            app.unmount = flattenFnArray(unmount);
            delete app.loadPromise;
            return app;
        }))

        
    }

    async function toMountPromise(app) {
        if(app.status !== NOT_MOUNTED) {
            return app;
        }
        app.status = MOUNTING;
        await app.mount(app.customProps);
        app.status = MOUNTED;
        return app;
    }

    async function toUnmountPromise(app) {
        // 如果当前应用没有被挂载 就什么都不做
        if(app.status !== MOUNTED) {
            return app;
        }
        app.status = UNMOUNTING;
        await app.unmount(app.customProps);
        app.status = NOT_MOUNTED;
        return app;
    }

    let started = false;
    function start() {
        // 需要挂载应用
        started = true;
        reroute(); // 除了去加载应用 还需要去挂载应用
    }

    // hashchange  popstate



    const routingEventsListeningTo = ['hashchange', 'popstate'];

    function urlReroute() { // 会根据路径重新加载不同的应用
        reroute();
    }
    const capturedEventListeners = { // 后续挂载的事件先暂存起来
        hashchange: [],
        popstate: [], // 当应用切换完成后可以调用 
    };
    // 我们处理应用加载的逻辑是在最前面
    window.addEventListener('hashchange', urlReroute);
    window.addEventListener('popstate', urlReroute); // 只监听浏览器前进后退 不监听history.pushState({}, '', '/a')方法

    const originalAddEventListener = window.addEventListener;
    const originlRemoveEventListener = window.removeEventListener;

    window.addEventListener = function(eventName, fn) {
        if(routingEventsListeningTo.indexOf(eventName) >= 0 && !capturedEventListeners[eventName].some(listener => listener === fn)) {
            capturedEventListeners[eventName].push(fn);
            return;
        }
        return originalAddEventListener.apply(this, arguments)
    };
    window.removeEventListener = function(eventName, fn) {
        if(routingEventsListeningTo.indexOf(eventName) >= 0) {
            capturedEventListeners[eventName] = capturedEventListeners[eventName].filter(l => l !== fn);
            return;
        }
        return originlRemoveEventListener.apply(this, arguments);
    };

    // 如果是hash路由 hash变化时可以切换
    // 浏览器路由，浏览器路由是h5api的 如果切换时不会触发popstate

    function patchedUpdateState(updateState, methodName) {
        return function() {
            const urlBefore = window.location.href;
            updateState.apply(this, arguments);
            const urlAfter = window.location.href;

            if(urlBefore !== urlAfter) {
                // 重新加载应用 传入事件源
                urlReroute(new PopStateEvent('popstate')); // urlReroute可以接收事件源参数 如：urlReroute(e){}
            }
        }
    }


    window.history.pushState = patchedUpdateState(window.history.pushState);
    window.history.replaceState = patchedUpdateState(window.history.replaceState);


    // 用户可能还会绑定自己的路由事件 比如 vue-router

    // 当我们应用切换后，还需要处理原来的方法，需要再应用切换后再执行

    // 核心应用处理方法
    function reroute() {

        // 需要获取要加载的应用
        // 需要获取要被挂在的应用
        // 哪些应用需要被卸载
        const { appsToLoad, appsToMount, appsToUnmount }= getAppChanges();
        // console.log(appsToLoad, appsToMount, appsToUnmount)
        // start方法调用时是同步的，但是加载流程是异步的
        if(started) {
            // console.log('调用start')
            // app 装载
            return performAppChanges();
        } else {
            // console.log('register')
            // 注册应用时需要预先加载
            return loadApps();
        }
        async function loadApps() { // 预先加载应用
            await Promise.all(appsToLoad.map(toLoadPromise)); // 就是为了获取到bootstrap,mount,unmount方法放到app上
        }
        async function performAppChanges() { // 根据路径来装载应用
            // 先卸载不需要的应用
            appsToUnmount.map(toUnmountPromise); // 需要去卸载的app  没有加Promise.all 并发处理
            // 去加载需要的应用
            // todo: 这个应用可能需要加载 但是路径不匹配 加载app1的时候 切换到了app2 所以需要在toBootstrapPromise/toMountPromise方法中再加入路径判断
            appsToLoad.map(async (app) => { // 将需要加载的应用拿到 => 加载 => 启动 => 挂载
                app = await toLoadPromise(app);
                app = await toBootstrapPromise(app);
                return toMountPromise(app); 
            });
            appsToMount.map(async (app) => { // 如果之前加载好的应用，走不到上边的方法，再单独进行挂载
                app = await toBootstrapPromise(app);
                return toMountPromise(app);
            });

        }
    }

    // 这个流程是用于初始化操作的，我们还需要做 当路径切换时重新加载应用
    // 需要重写路由相关的方法

    /**
     * 
     * @param {*} appName 应用名称
     * @param {*} loadApp 加载的应用
     * @param {*} activeWhen 当激活时会调用loadApp
     * @param {*} customProps 自定义属性
     */
    const apps = []; // 用来存放所有的应用

    // 维护应用所有的状态 状态机
    function registerApplication(appName, loadApp, activeWhen,customProps) {
        apps.push({ // 这里就把应用注册好了
            name: appName,
            loadApp,
            activeWhen,
            customProps,
            status: NOT_LOADED
        });
        // console.log(apps)
        // 类似vue 加载的时候会执行一系列的生命周期
        reroute();
    }

    function getAppChanges() {
        const appsToLoad = []; // 需要加载的app
        const appsToMount = []; // 需要挂载的app
        const appsToUnmount = []; // 需要卸载的app
        apps.forEach(app=>{
            // 需不需要被加载
            const appShouldBeActive = app.status !== SKIP_BECAUSE_BROKEN &&  shouldBeActive(app);
            switch (app.status) {
                case NOT_LOADED:
                case LOADING_SOURCE_CODE:
                    if(appShouldBeActive) {
                        appsToLoad.push(app);
                    }
                    break;
                case NOT_BOOTSTRAPPED:
                case BOOTSTRAPPING:
                case NOT_MOUNTED: 
                    if(appShouldBeActive) {
                        appsToMount.push(app);
                    }
                    break;
                case MOUNTED:
                    if(!appShouldBeActive) {
                        appsToUnmount.push(app);
                    }
                    break;
            }
        });
        return {appsToLoad,appsToMount,appsToUnmount}

    }

    exports.registerApplication = registerApplication;
    exports.start = start;

}));
