require('request')({
    url: 'http://localhost:8080/kickback',
    method: "POST",
    json: true,
    body: {data: process.argv.slice(3), kickID: process.argv[2]}
}, (err, resp, body) => process.exit());