import { Worker as NodeWorker, isMainThread, parentPort, workerData } from 'worker_threads';
import { resolve } from 'path';

export const runCsvWorker = (recordsCount: number): Promise<string> => {
    return new Promise((resolvePromise, reject) => {
        const workerFile = resolve(__dirname, 'csvWorker.js');
        const worker = new NodeWorker(workerFile, {
            workerData: { count: recordsCount },
            // Use ts-node/register to run ts file in dev natively if passing .ts, 
            // but compiling requires .js. Assuming we build or use tsx.
            execArgv: process.env.NODE_ENV === 'development' ? ['--require', 'tsx/cjs'] : [],
        });

        worker.on('message', resolvePromise);
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        });
    });
};
