export const VITC_COLOR = "#fffd6c"
export const VITABOT_GITHUB = "https://github.com/jeanouina/VitaBot"
export const BOT_VERSION = require("../../package.json").version

export type Networks = "VITE"
export type Platform = "Discord" | "Twitter" | "Reddit" | 
    "Discord.Giveaway" | "Twitter.Giveaway" | "Reddit.Giveaway" | 
    "Discord.Airdrop" | "Twitter.Airdrop" | "Reddit.Airdrop" | 
    "Faucet" | "Quota"

export const tokenIds = {
    VITE: "tti_5649544520544f4b454e6e40",
    VITC: "tti_22d0b205bed4d268a05dfc3c",
    BAN: "tti_61f59e574f9f7babfe8908e5",
    NANO: "tti_29a2af20212b985e9d49e899",
    BTC: "tti_b90c9baffffc9dae58d1f33f",
    VX: "tti_564954455820434f494e69b5",
    VCP: "tti_251a3e67a41b5ea2373936c8",
    XMR: "tti_e5750d3c5b3bb5a31b8ba637",
    ETH: "tti_687d8a93915393b219212c73"
}
export const tokenTickers = {
    tti_5649544520544f4b454e6e40: "VITE",
    tti_22d0b205bed4d268a05dfc3c: "VITC",
    tti_61f59e574f9f7babfe8908e5: "BAN",
    tti_29a2af20212b985e9d49e899: "NANO",
    tti_b90c9baffffc9dae58d1f33f: "BTC",
    tti_564954455820434f494e69b5: "VX",
    tti_251a3e67a41b5ea2373936c8: "VCP",
    tti_e5750d3c5b3bb5a31b8ba637: "XMR",
    tti_687d8a93915393b219212c73: "ETH"
}
export const tokenDecimals = {
    VITE: 18,
    VITC: 18,
    BAN: 29,
    NANO: 30,
    BTC: 8,
    VX: 18,
    VCP: 0,
    XMR: 12,
    ETH: 18
}
export const tokenNames = {
    VITE: "Vite",
    VITC: "Vitamin Coin 💊",
    BAN: "Banano 🍌",
    NANO: "Nano"
}

// https://i.imgur.com/1hYUMmF.png
export const VITABOT_SPLASH = ` ___      ___ ___  _________  ________  ________  ________  _________   
|\\  \\    /  /|\\  \\|\\___   ___\\\\   __  \\|\\   __  \\|\\   __  \\|\\___   ___\\ 
\\ \\  \\  /  / | \\  \\|___ \\  \\_\\ \\  \\|\\  \\ \\  \\|\\ /\\ \\  \\|\\  \\|___ \\  \\_| 
 \\ \\  \\/  / / \\ \\  \\   \\ \\  \\ \\ \\   __  \\ \\   __  \\ \\  \\\\\\  \\   \\ \\  \\  
  \\ \\    / /   \\ \\  \\   \\ \\  \\ \\ \\  \\ \\  \\ \\  \\|\\  \\ \\  \\\\\\  \\   \\ \\  \\ 
   \\ \\__/ /     \\ \\__\\   \\ \\__\\ \\ \\__\\ \\__\\ \\_______\\ \\_______\\   \\ \\__\\
    \\|__|/       \\|__|    \\|__|  \\|__|\\|__|\\|_______|\\|_______|    \\|__|`