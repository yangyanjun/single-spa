// hashchange  popstate

import { reroute } from "./reroute";


export const routingEventsListeningTo = ['hashchange', 'popstate'];

function urlReroute() { // 会根据路径重新加载不同的应用
    reroute([], arguments);
}
const capturedEventListeners = { // 后续挂载的事件先暂存起来
    hashchange: [],
    popstate: [], // 当应用切换完成后可以调用 
}
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
}
window.removeEventListener = function(eventName, fn) {
    if(routingEventsListeningTo.indexOf(eventName) >= 0) {
        capturedEventListeners[eventName] = capturedEventListeners[eventName].filter(l => l !== fn);
        return;
    }
    return originlRemoveEventListener.apply(this, arguments);
}

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


window.history.pushState = patchedUpdateState(window.history.pushState, 'pushState');
window.history.replaceState = patchedUpdateState(window.history.replaceState, 'replaceState');


// 用户可能还会绑定自己的路由事件 比如 vue-router

// 当我们应用切换后，还需要处理原来的方法，需要再应用切换后再执行
