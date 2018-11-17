# service-manager

service 是常驻内存的程序。一个 service 表示为一个类，具有如下接口：

```js
class Service1 {
    constructor : function(context : ServiceAccessor)
    start : Promise | async function,
    stop : Promise | async function,
}
```

然后我们可以把这个 Service1 注册到 service-manager：

```js
import Promise from 'bluebird';
import ServiceManager from 'service-manager';

const manager = new ServiceManager(); // 创建一个 service-manager。

manager
    .service('service1') // 定义一个 service，命名为 'service2'。返回一个对 service2 的设置器。
    .registry(Service1); // 将 Service1 注册到 service1

Promise
    .try(() => manager
        .service('service1') // 因为 service1 已经定义，所以直接返回 service1 的设置器。
        .start(); // 启动 service1。
    .delay(1000)
    .then(() => manager
        .service('service1')
        .stop()); // 停止 service1。
```

你可以设置一个 service 在停止后再次启动时是要重新创建一个 Service 类的实例还是复用之前的实例：

```js
manager
    .service('service1')
    .reusable(true); // true 表示复用，默认为 false。不加参数返回当前值。
```

设置器上的操作是可以链式调用的：

```js
manager
    .service('service1')
    .registry(Service1)
    .reusable(true)
    .start();
```

service 之间有时会有一定依赖关系。假设 service2 依赖于 service1，那么 service1 必须比 service2 先 start，service2 必须比 service1 先 stop。

service-manager 用来设置 service 间的依赖关系并自动管理 start 和 stop 的顺序。

```js
manager
    .service('service2')
    .registry(Service2)
    .dependencies('service1'); // 添加 service1 到 service2 的依赖中。不加参数返回已添加的依赖数组。

manager
    .service('service1')
    .registry(Service1);

Promise
    .try(::(manager
        .service('service2')
        .start)) // 启动 service2 之前，manager 会自动先递归地启动所有它直接或间接依赖的 service。
    .delay(1000)
    .then(::(manager
        .service('service1')
        .stop)); // 停止 service1 之前，manager 会自动先递归地停止所有直接或间接依赖于它的 service。
```

除了 functional programming 写法之外，当然你也可以用 imperative programming 的写法：

```js
(async () => {
    await manager.service('service2').start();
    await Promise.delay(1000);
    await manager.service('service1').stop();
})();
```

你也可以一次性启动或停止所有 service。

```js
Promise
    .try(::manager.startAll)
    .then(::manager.stopAll);
```

设置器继承了 manager 的以下方法：

- service
- startAll
- stopAll

所以可以进行如下优美操作：

```js
manager
    .service('service2')
    .registry(Service2)
    .dependencies('service1')

    .service('service1') // 设置器可以直接切换。
    .registry(Service1)

    .service('service3') // 直接切换到 service3 的设置器。
    .dependencies('service1', 'service2')
    .registry(Service3)

    .startAll(); // 直接在设置器上启动所有 service。
```

设置器的 registry 方法不带参数时会返回注册的 Service 类的实例。设置器对象会作为上下文传入 Service 类的构造函数。这样就可以实现 service 间互相调用方法了。

```js
class Service1 {
    somePublicMethod() {
        return 'something';
    }

    async start() {}
    async stop() {}
}

class Service2 {
    constructor(context){
        this.__context = context; // 赶紧保存下来。
    }

    __someMethod() {
        const service1 = this
            .__context // service2 自己的设置器。
            .service('service1') // 切换到 service1 的设置器。
            .registry(); // 获取 service1 的本体。
        console.log(service1 instanceof Service1); // true
        console.log(service1.somePublicMethed()); // 这样调用另一个 service 的方法就非常方便了。
    }

    async start() {}
    async stop() {}
}
```

manager 也是一个 EventEmitter，抛出错误只需调用上下文的 error 方法：

```js
class Service1 {
    constructor(context) {
        this.__context = context;
    }

    __someMethod() {
        this.__context.error(new Error('some error')); // 这样就会触发 manager 的 'error' 事件。
    }

    async start() {}
    async stop() {}
}
```

有时会发生导致 service 崩溃的致命错误，你只需要在崩溃后调用上下文的fatal方法。manager 会自动递归地停止所有直接或间接依赖于这个 service 的所有 service，并在完成停止后触发 manager 上的 'fatal' 事件，事件参数是这个 service 的名称。

```js
class Service1 {
    constructor(context) {
        this.__context = context;
    }

    __someMethod() {
        // 参数 reusable 表示以后再次启动时是要重新创建一个 Service 类的实例还是复用之前的实例
        // true 表示复用，默认为设置器上设置的值。
        this.__context.fatal(true);
    }

    async start() {}
    async stop() {}
}
```