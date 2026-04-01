import 'dotenv/config';
import { aiService } from './src/services/ai.service';

async function run() {
    try {
        console.log('Sending goal context to Gemini API directly...');
        const result = await aiService.breakdownTask('Plan a technical architecture migration');

        console.log('\n✅ AI Generation Succeeded!');
        console.log(JSON.stringify(result, null, 2));

    } catch (err: any) {
        console.error('\n❌ AI Generation Failed:');
        if (err.detail) {
            console.error(err.detail);
        } else {
            console.error(err.message || err);
        }
    } finally {
        process.exit(0);
    }
}

run();
