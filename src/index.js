import EventEmitter from 'events';
import Promise from 'bluebird';

class Service {
    constructor(manager, name) {
        Object.assign(this, {
            __manager: manager,
            name,
            __dependencies: [],
            supports: [],
            __registry: null,
            __reusable: false,
            starting: null,
            stopping: Promise.resolve(),
            ServiceClass: null,
            service: ::manager.service,
            startAll: ::manager.startAll,
            stopAll: ::manager.stopAll,
        });
    }

    error(error) {
        this.__manager.emit('error', error);
    }

    fatal(reusable = this.__reusable) {
        this.starting = null;
        this.stopping = Promise.resolve();
        if (!reusable) this.__registry = null;
        return Promise
            .resolve(this.supports)
            .map(support => this.__manager.services[support].stop())
            .then(() => this.__manager.emit('fatal', this.name));
    }

    dependencies(...dependencies) {
        if (dependencies) {
            this.__dependencies.push(...dependencies);
            dependencies.forEach((dependency) => {
                this.service(dependency).supports.push(this.name);
            });
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
            return this;
        } return this.__registry;
    }

    __constructService() {
        this.__registry ||= new this.__ServiceClass(this, ...this.__args);
    }

    start() {
        if (this.stopping?.isPending()) return Promise.reject();
        this.stopping = null;
        this.starting ||= Promise
            .resolve(this.__dependencies)
            .map(dependency => this.__manager.services[dependency].start())
            .then(this.__constructService)
            .then(::this.__registry.start);
        return this.starting;
    }

    stop() {
        if (this.starting?.isPending()) return Promise.reject();
        this.starting = null;
        this.stopping ||= Promise
            .resolve(this.supports)
            .map(support => this.__manager.services[support].stop())
            .then(::this.__registry.stop)
            .then(() => {
                if (!this.__reusable) this.__registry = null;
            });
        return this.stopping;
    }
}

class ServiceManager extends EventEmitter {
    constructor() {
        super();

        Object.assign(this, {
            services: {},
        });
    }

    service(serviceName) {
        this.services[serviceName] ||= new Service(this, serviceName);
        return this.services[serviceName];
    }

    startAll() {
        return Promise
            .resolve(this.services)
            .then(::Object.values)
            .map(service => service.start());
    }

    stopAll() {
        return Promise
            .resolve(this.services)
            .then(::Object.values)
            .map(service => service.stop());
    }
}

export default ServiceManager;
