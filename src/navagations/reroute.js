import { getAppChanges } from "../applications/app";
import { toBootstrapPromise } from "../lifecycles/bootstrap";
import { toLoadPromise } from "../lifecycles/load";
import { toMountPromise } from "../lifecycles/mount";
import { toUnmountPromise } from "../lifecycles/unmount";
import { started } from "../start";
import './navigator-events';

// 核心应用处理方法
export function reroute() {

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
        let apps = await Promise.all(appsToLoad.map(toLoadPromise)) // 就是为了获取到bootstrap,mount,unmount方法放到app上
    }
    async function performAppChanges() { // 根据路径来装载应用
        // 先卸载不需要的应用
        let unmountPromises = appsToUnmount.map(toUnmountPromise); // 需要去卸载的app  没有加Promise.all 并发处理
        // 去加载需要的应用
        // todo: 这个应用可能需要加载 但是路径不匹配 加载app1的时候 切换到了app2 所以需要在toBootstrapPromise/toMountPromise方法中再加入路径判断
        appsToLoad.map(async (app) => { // 将需要加载的应用拿到 => 加载 => 启动 => 挂载
            app = await toLoadPromise(app);
            app = await toBootstrapPromise(app);
            return toMountPromise(app); 
        })
        appsToMount.map(async (app) => { // 如果之前加载好的应用，走不到上边的方法，再单独进行挂载
            app = await toBootstrapPromise(app);
            return toMountPromise(app);
        })

    }
}

// 这个流程是用于初始化操作的，我们还需要做 当路径切换时重新加载应用
// 需要重写路由相关的方法