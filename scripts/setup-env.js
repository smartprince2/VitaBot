const inquirer = require("inquirer")
const modernlog = require("modernlog")
modernlog.patch()
const { existsSync } = require("fs")
const { join } = require("path")
const WebSocket = require("ws")
const {promises} = require("fs")

;(async () => {
    const envPath = join(__dirname, "../.env")
    if(existsSync(envPath)){
        console.warn(`A configuration under \x1b[33m${envPath}\x1b[37m already exists. `)
        const answers = await inquirer.prompt([
            {
                type: "confirm",
                name: "overwrite",
                message: `Are you sure you want to erase it?`,
                default: false
            }
        ])
        
        if(!answers.overwrite){
            process.exit(0)
        }
        
        console.warn(`\x1b[31mOverwriting ${envPath}\x1b[37m`)
        process.stdout.write("\n")
    }
    
    console.info("Hint: Official means it's from Vitelabs themselves.")
    const nodeChoices = [
        {
            value: "fastest",
            name: "Fastest (\x1b[32mRecommended\x1b[37m)",
            url: null
        },
        {
            value: "vitanode",
            name: "\x1b[33mVitamin Coin\x1b[37m's node (\x1b[35mFrance\x1b[37m) (\x1b[32mRecommended\x1b[37m)",
            url: "wss://vitanode.lightcord.org/ws"
        },
        {
            value: "node-tokyo",
            name: "Official \x1b[34mvite\x1b[37m node (\x1b[35mTokyo\x1b[37m) (\x1b[31mUsually Slower\x1b[37m)",
            url: "wss://node-tokyo.vite.net/ws"
        },
        {
            value: "localhost",
            name: "Localhost",
            url: "ws://127.0.0.1:41420"
        },
        {
            value: "custom",
            name: "Custom Node",
            url: null
        }
    ]
    let answers = await inquirer.prompt([
        {
            type: "list",
            name: "node",
            message: "What VITE node do you want to use?",
            choices: nodeChoices.map(choice => {
                return {
                    name: choice.name,
                    value: choice.value
                }
            }),
            default: "vitanode"
        }
    ])
    const node = nodeChoices.find(e => e.value === answers.node)
    if(!node.url){
        // find url
        switch(node.value){
            case "fastest": {
                
                console.log("Searching fastest node...")
                const results = []
                for(let n of nodeChoices){
                    if(!n.url)continue
                    
                    console.info(`Trying \x1b[33m${n.url}\x1b[37m`)
                    // not using vitejs because it's not low-level, I don't want to import everything.
                    const ws = new WebSocket(n.url, {
                        timeout: 10000
                    })
                    const result = await new Promise((resolve) => {
                        ws.on("error", () => {
                            resolve("unreachable")
                        })
                        ws.on("open", () => {
                            // open, send the payload and disconnect.
                            const start = Date.now()
                            ws.send(JSON.stringify({
                                jsonrpc: "2.0",
                                id: 1,
                                method: "ledger_getSnapshotChainHeight",
                                params: null
                            }))
                            const timeout = setTimeout(() => {
                                ws.terminate()
                                resolve("unreachable")
                            }, 10000)
                            ws.on("message", data => {
                                try{
                                    const msg = JSON.parse(data.toString("utf8"))
                                    if(msg.id !== 1)return
                                    const end = Date.now()
                                    clearTimeout(timeout)
                                    resolve(end-start)
                                    ws.close(1000)
                                }catch{}
                            })
                        })
                    })
                    if(result === "unreachable"){
                        
                        console.error(`Node \x1b[33m${n.url}\x1b[37m is unreachable.`)
                        continue
                    }
                    results.push({
                        url: n.url,
                        latency: result
                    })
                }
                const fastest = results.sort((a, b) => a.latency-b.latency)[0]
                if(!fastest){
                    
                    console.error("Couldn't find the fastest node.")
                    process.exit(1)
                }
                
                console.log(`Using \x1b[33m${fastest.url}\x1b[37m with a latency of \x1b[33m${fastest.latency} ms\x1b[37m.`)
                node.url = fastest.url
                break
            }
            case "custom": {
                const {url} = await inquirer.prompt([
                    {
                        type: "input",
                        name: "url",
                        message: "What's the url of the VITE node you want to use?",
                        validate(value){
                            let url
                            try{
                                url = new URL(value)
                            }catch{
                                return "Invalid URL"
                            }

                            if(!/^wss?:$/.test(url.protocol))return "Invalid protocol: "+url.protocol
                            return true
                        }
                    }
                ])
                node.url = url
            }
        }
    }
    
    console.log(`Using \x1b[33m${node.url}\x1b[37m as node !`)
    process.stdout.write("\n")
    
    console.log(`MongoDB related settings!`)
    const {
        MONGO_URL,
        MONGO_USER,
        MONGO_PASSWORD
    } = await inquirer.prompt([
        {
            type: "input",
            name: "MONGO_URL",
            message: "What's the URL of the database?",
            validate(value){
                let url
                try{
                    url = new URL(value)
                }catch{
                    return "Invalid URL"
                }

                if(!/^mongodb(\+srv)?:$/.test(url.protocol))return "Invalid protocol: "+url.protocol
                return true
            }
        },
        {
            type: "input",
            name: "MONGO_USER",
            message: "What's the username of the database?"
        },
        {
            type: "password",
            name: "MONGO_PASSWORD",
            message: "What's the password of the database?"
        }
    ])

    process.stdout.write("\n")

    console.log("Discord related settings!")

    const {
        DISCORD_TOKEN,
        DISCORD_PREFIX
    } = await inquirer.prompt([
        {
            type: "input",
            name: "DISCORD_TOKEN",
            message: "What's the token of the bot? (https://discord.com/developers)"
        },
        {
            type: "input",
            name: "DISCORD_PREFIX",
            message: "What's the prefix of the bot?",
            default: "."
        }
    ])

    process.stdout.write("\n")

    console.log("Twitter related settings!")

    const {
        TWITTER_API_KEY,
        TWITTER_API_SECRET,
        TWITTER_BEARER_TOKEN,
        TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_TOKEN_SECRET
    } = await inquirer.prompt([
        {
            type: "input",
            name: "TWITTER_API_KEY",
            message: "What's the api key of the bot?"
        },
        {
            type: "input",
            name: "TWITTER_API_SECRET",
            message: "What's the api secret of the bot?"
        },
        {
            type: "input",
            name: "TWITTER_BEARER_TOKEN",
            message: "What's the bearer token of the bot?"
        },
        {
            type: "input",
            name: "TWITTER_ACCESS_TOKEN",
            message: "What's the access token of the bot?"
        },
        {
            type: "input",
            name: "TWITTER_ACCESS_TOKEN_SECRET",
            message: "What's the access token secret of the bot?"
        }
    ])

    const env = `# VITE related settings
${nodeChoices.filter(n => !!n.url).map(n => {
    return `# ${n.value}
${n.value === node.value ? "" : "# "}VITE_WS=${n.url}`
}).join("\n")}

# MongoDB related settings
MONGO_URL=${MONGO_URL}
MONGO_USER=${MONGO_USER}
MONGO_PASSWORD=${MONGO_PASSWORD}

# Discord related settings
# Bot token
DISCORD_TOKEN_=${DISCORD_TOKEN}
# Bot prefix
DISCORD_PREFIX=${DISCORD_PREFIX}

# Twitter related settings
TWITTER_API_KEY=${TWITTER_API_KEY}
TWITTER_API_SECRET=${TWITTER_API_SECRET}
TWITTER_BEARER_TOKEN=${TWITTER_BEARER_TOKEN}
TWITTER_ACCESS_TOKEN=${TWITTER_ACCESS_TOKEN}
TWITTER_ACCESS_TOKEN_SECRET=${TWITTER_ACCESS_TOKEN_SECRET}
`
    await promises.writeFile(envPath, env)
})()