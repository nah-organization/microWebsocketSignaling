import EventEmitter from "events";

export type eventTypedEmitter<E extends { [P in string]: unknown[] }> = {
    emit<T extends keyof E>(event: T, ...args: E[T]): void;
};

export type eventTypedAddListener<E extends { [P in string]: unknown[] }> = {
    on<T extends keyof E>(event: T, listener: (...args: E[T]) => void): eventTypedAddListener<E>,
    once<T extends keyof E>(event: T, listener: (...args: E[T]) => void): eventTypedAddListener<E>,
    off<T extends keyof E>(event: T, listener: (...args: E[T]) => void): eventTypedAddListener<E>,
};

export type eventTypedEventEmitter<E extends { [P in string]: unknown[] }> = eventTypedEmitter<E> & eventTypedAddListener<E>;

type TypedEventEmitterConstructor = { new <T extends { [P in string]: unknown[] }>(): eventTypedEventEmitter<T>; };

export const TypedEventEmitter: TypedEventEmitterConstructor = EventEmitter as TypedEventEmitterConstructor;

export function eventEmitterLogger<T extends eventTypedEmitter<{ [P in string]: unknown[] }>>(ee: T, logger: typeof console.log = console.log) {
    const defaultEmit = ee.emit.bind(ee);

    ee.emit = (type, ...arg) => {
        logger(`event emitter emited. type: `, JSON.stringify(type), `, data: `, ...arg);
        defaultEmit(type, ...arg);
    };
    return ee;
}
