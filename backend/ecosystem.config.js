module.exports = {
    apps: [
        {
            name: 'task-management-api',
            script: './dist/index.js',
            interpreter: 'bun',
            instances: 'max',
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'development',
            },
            env_production: {
                NODE_ENV: 'production',
            }
        }
    ]
};
