import EventEmitter from 'events';
import Promise from 'bluebird';

class ServiceAccessor {
    constructor(manager, name) {
        Object.assign(this, {
            __manager: manager,
            __name: name,
            // __dependencies and __supports are mutable Iterable.
            __dependencies: new Set(),
            __supports: new Set(),
            __registry: null,
            __reusable: false,
            __starting: null,
            __stopping: Promise.resolve(),
            __ServiceClass: null,
        });
    }

    get name() {
        return this.__name;
    }

    get supports() {
        return this.__supports;
    }

    get service() {
        return ::this.__manager.service;
    }

    get startAll() {
        return ::this.__manager.startAll;
    }

    get stopAll() {
        return ::this.__manager.stopAll;
    }

    error(error) {
        this.__manager.emit('error', error);
    }

    fatal(reusable = this.__reusable) {
        this.__starting = null;
        this.__stopping = Promise.resolve();
        if (!reusable) this.__registry = null;
        return Promise
            .resolve(this.__supports)
            .map(support => this.service(support).stop())
            .then(() => this.__manager.emit('fatal', this.__name));
    }

    deleteDependencies(...dependencies) {
        dependencies.forEach((dependency) => {
            this.service(dependency).supports.delete(this.__name);
            this.__dependencies.delete(dependency);
        });
        return this;
    }

    addDependencies(...dependencies) {
        dependencies.forEach((dependency) => {
            this.__dependencies.add(dependency);
            this.service(dependency).supports.add(this.__name);
        });
        return this;
    }

    dependencies(...dependencies) {
        if (dependencies.length) {
            this.deleteDependencies(...this.__dependencies);
            this.addDependencies(...dependencies);
            return this;
        } return this.__dependencies;
    }

    reusable(reusable) {
        if (reusable) {
            this.__reusable = reusable;
            return this;
        } return this.__reusable;
    }

    registry(ServiceClass, ...args) {
        if (ServiceClass) {
            this.__ServiceClass = ServiceClass;
            this.__args = args;
            this.__registry = null;
            return this;
        }
        if (this.isStarted()) return this.__registry;
        throw new Error('cannot get service instance when the service is not running');
    }

    __constructService() {
        if (!this.__ServiceClass) throw new Error('service class is not mounted');
        this.__registry ||= new this.__ServiceClass(this, ...this.__args);
        return this.__registry;
    }

    start() {
        if (this.isStopping()) return Promise.reject();
        this.__stopping = null;
        this.__starting ||= Promise
            .resolve(this.__dependencies)
            .map(dependency => this.service(dependency).start())
            .then(::this.__constructService)
            .then(registry => registry.start());
        return this.__starting;
    }

    stop() {
        if (this.isStarting()) return Promise.reject();
        this.__starting = null;
        this.__stopping ||= Promise
            .resolve(this.__supports)
            .map(support => this.service(support).stop())
            .then(::this.__registry.stop)
            .then(() => {
                if (!this.__reusable) this.__registry = null;
            });
        return this.__stopping;
    }

    isStarting() {
        return this.__starting?.isPending();
    }

    isStarted() {
        return this.__starting?.isFulfilled();
    }

    isStopping() {
        return this.__stopping?.isPending();
    }

    isStopped() {
        return this.__stopping?.isFulfilled();
    }
}

class ServiceManager extends EventEmitter {
    constructor() {
        super();

        Object.assign(this, {
            __services: {},
        });
    }

    service(serviceName) {
        this.__services[serviceName] ||= new ServiceAccessor(this, serviceName);
        return this.__services[serviceName];
    }

    startAll() {
        return Promise
            .resolve(this.__services)
            .then(::Object.values)
            .map(service => service.start());
    }

    stopAll() {
        return Promise
            .resolve(this.__services)
            .then(::Object.values)
            .map(service => service.stop());
    }
}

export default ServiceManager;
