import { reroute } from "../navagations/reroute";
import { BOOTSTRAPPING, LOADING_SOURCE_CODE, MOUNTED, NOT_BOOTSTRAPPED, NOT_LOADED, NOT_MOUNTED, shouldBeActive, SKIP_BECAUSE_BROKEN } from "./app.helpers";

/**
 * 
 * @param {*} appName 应用名称
 * @param {*} loadApp 加载的应用
 * @param {*} activeWhen 当激活时会调用loadApp
 * @param {*} customProps 自定义属性
 */
const apps = []; // 用来存放所有的应用

// 维护应用所有的状态 状态机
export function registerApplication(appName, loadApp, activeWhen,customProps) {
    apps.push({ // 这里就把应用注册好了
        name: appName,
        loadApp,
        activeWhen,
        customProps,
        status: NOT_LOADED
    })
    // console.log(apps)
    // 类似vue 加载的时候会执行一系列的生命周期
    reroute()
}

export function getAppChanges() {
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
            default:
                break;
        }
    })
    return {appsToLoad,appsToMount,appsToUnmount}

}