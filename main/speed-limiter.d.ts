declare module 'speed-limiter' {
    import { Transform } from 'stream';

    interface ThrottleGroupOptions {
        rate?: number;
        enabled?: boolean;
        chunksize?: number;
    }

    interface ThrottleOptions {
        [key: string]: unknown;
    }

    class ThrottleGroup {
        constructor(opts?: ThrottleGroupOptions);
        getEnabled(): boolean;
        getRate(): number;
        getChunksize(): number;
        setEnabled(val: boolean): void;
        setRate(rate: number, chunksize?: number): void;
        setChunksize(chunksize: number): void;
        throttle(opts?: ThrottleOptions): Throttle;
        destroy(): void;
        throttles: Throttle[];
    }

    class Throttle extends Transform {
        constructor(opts?: ThrottleOptions);
        getEnabled(): boolean;
        getGroup(): ThrottleGroup;
        setEnabled(val: boolean): void;
        destroy(...args: unknown[]): void;
    }

    export { ThrottleGroup, Throttle };
}
