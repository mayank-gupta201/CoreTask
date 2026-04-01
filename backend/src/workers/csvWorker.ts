import { parentPort, workerData } from 'worker_threads';

const generateCsv = (count: number) => {
    let csv = 'id,name,value\n';
    for (let i = 0; i < count; i++) {
        csv += `${i},Item ${i},${Math.random()}\n`;
        // Artificial CPU work
        for (let j = 0; j < 1000; j++) { }
    }
    return csv;
};

if (parentPort) {
    try {
        const result = generateCsv(workerData.count);
        parentPort.postMessage(result);
    } catch (error) {
        throw error;
    }
}
