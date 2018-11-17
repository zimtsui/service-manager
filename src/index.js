class Service {
    constructor(manager, name) {
        Object.assign(this, {
            __manager: manager,
            name,
            __dependencies: [],
            supports: [],
        });
    }

    dependencies(dependencies) {
        if (dependencies) {
            this.__dependencies.push(...dependencies);
            dependencies.forEach((dependency) => {
                this.__manager.service(dependency).supports.push(this.name);
            });
            return this;
        }
        return this.__dependencies;
    }

    object(object) {
        this.__object = object;
        return this;
    }

    start() {
        if (!this.stopping) {
            this.starting ||= Promise
                .resolve(this.dependencies())
                .map(dependency => this.__manager.service(dependency).start())
                .then(::this.__object.start)
                .then(() => {
                    this.state = Service.States.STARTED;
                });
            return this.starting;
        } return Promise.reject();
    }

    stop() {
        if (this.starting?.isFulfilled()) {
            this.stopping ||= Promise
                .resolve(this.supports)
                .map(support => this.__manager.service(support).stop())
                .then(::this.__object.stop)
                .then(() => {
                    this.state = Service.States.STOPPED;
                });
            return this.stopping;
        } return Promise.reject();
    }
}

class ServiceManager {
    constructor() {
        this.__services = {};
    }

    service(serviceName) {
        this.__services[serviceName] ||= new Service(this, serviceName);
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
