

const availableNodes = [
    ...new Set([
        process.env.VITE_WS,
        "wss://vitanode.lightcord.org/ws",
        "wss://node-tokyo.vite.net/ws"
    ])
]