module.exports = {
    apps: [{
        name: "naver-scraper",
        script: "./dist/app.js",
        instances: "max",
        exec_mode: "cluster",
        watch: false,
        max_memory_restart: "1G", // Auto-restart if memory exceeds 1GB
        env: {
            NODE_ENV: "production",
        },
        error_file: "./logs/pm2-error.log",
        out_file: "./logs/pm2-out.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss"
    }]
}
