export const VITC_COLOR = "#e7581c"
export const VITABOT_GITHUB = "https://github.com/jeanouina/VitaBot"
export const BOT_VERSION = require("../../package.json").version

export type Networks = "VITE"
export type RawPlatform = "Discord" | "Twitter" | "Reddit"
export type Platform = RawPlatform |
    "Discord.Giveaway" | "Twitter.Giveaway" | "Reddit.Giveaway" | 
    "Discord.Airdrop" | "Twitter.Airdrop" | "Reddit.Airdrop" | 
    "Faucet" | "Quota" | "Rewards"

export const tokenIds = {
    VITE: "tti_5649544520544f4b454e6e40",
    VITC: "tti_22d0b205bed4d268a05dfc3c",
    BAN: "tti_f9bd6782f966f899d74d7df8",
    NANO: "tti_29a2af20212b985e9d49e899",
    BTC: "tti_b90c9baffffc9dae58d1f33f",
    VX: "tti_564954455820434f494e69b5",
    VCP: "tti_251a3e67a41b5ea2373936c8",
    XMR: "tti_e5750d3c5b3bb5a31b8ba637",
    ETH: "tti_687d8a93915393b219212c73",
    USDT: "tti_80f3751485e4e83456059473",
    VINU: "tti_541b25bd5e5db35166864096"
}
export const tokenTickers = {
    [tokenIds.VITE]: "VITE",
    [tokenIds.VITC]: "VITC",
    [tokenIds.BAN]: "BAN",
    [tokenIds.NANO]: "NANO",
    [tokenIds.BTC]: "BTC",
    [tokenIds.VX]: "VX",
    [tokenIds.VCP]: "VCP",
    [tokenIds.XMR]: "XMR",
    [tokenIds.ETH]: "ETH",
    [tokenIds.USDT]: "USDT",
    [tokenIds.VINU]: "VINU"
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
    ETH: 18,
    USDT: 6,
    VINU: 8
}
export const tokenNames = {
    VITE: "Vite",
    VITC: "Vitamin Coin",
    BAN: "Banano",
    NANO: "Nano",
    BUS: "Bussycoin",
    XRB: "RayBlocks",
    BANG: "Banano Gold",
    BROCC: "Broccoli 🥦",
    "VINU-000": "Vita Inu [old]"
}

export const discordEmojis = {
    VITE: "<:Vite:902884192545816626>",
    VITC: "<:Vitc:909415321964789821>",
    BAN: "<:Banano:902883289478594611>",
    NANO: "<:Nano:902883450820898817>",
    BUS: "<:BussyCoin:902882531303649321>",
    XRB: "<:RayBlocks:911705047509925978>",
    BANG: "<:BananoGold:902882181087649842>",
    VICAT: "<:ViCat:908227330344910869>",
    VINU: "<:vitainuhead:905570151867490374>"
}

export const disabledTokens = {
    tti_3340701118e8a54d34b52355: "Old VINU Token"
}

export const twitterEmojis = {
    VITC: "💊",
    BAN: "🍌",
    VINU: "🐕",
    VICAT: "🐱"
}

export const allowedCoins = {
    "862416292760649768": [
        tokenIds.VITC,
        tokenIds.VITE,
        tokenIds.NANO,
        tokenIds.BAN
    ],
    "907279842716835881": [
        tokenIds.VITC,
        tokenIds.VITE,
        tokenIds.NANO,
        tokenIds.BAN
    ]
}

// https://i.imgur.com/1hYUMmF.png
export const VITABOT_SPLASH = ` ___      ___ ___  _________  ________  ________  ________  _________   
|\\  \\    /  /|\\  \\|\\___   ___\\\\   __  \\|\\   __  \\|\\   __  \\|\\___   ___\\ 
\\ \\  \\  /  / | \\  \\|___ \\  \\_\\ \\  \\|\\  \\ \\  \\|\\ /\\ \\  \\|\\  \\|___ \\  \\_| 
 \\ \\  \\/  / / \\ \\  \\   \\ \\  \\ \\ \\   __  \\ \\   __  \\ \\  \\\\\\  \\   \\ \\  \\  
  \\ \\    / /   \\ \\  \\   \\ \\  \\ \\ \\  \\ \\  \\ \\  \\|\\  \\ \\  \\\\\\  \\   \\ \\  \\ 
   \\ \\__/ /     \\ \\__\\   \\ \\__\\ \\ \\__\\ \\__\\ \\_______\\ \\_______\\   \\ \\__\\
    \\|__|/       \\|__|    \\|__|  \\|__|\\|__|\\|_______|\\|_______|    \\|__|`