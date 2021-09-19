import { tokenDecimals, tokenIds, tokenNames, tokenTickers } from "../common/constants";
import { WebsocketConnection } from "../libwallet/ws";
import { GetTokenResponse, requestWallet } from "../libwallet/http";
import events from "../common/events";

export const walletConnection = new WebsocketConnection()

;(async () => {
    await walletConnection.connect()
    const tokens:GetTokenResponse = await requestWallet("get_tokens")

    for(const ticker in tokens.token_decimals){
        tokenDecimals[ticker] = tokens.token_decimals[ticker]
    }
    for(const ticker in tokens.token_ids){
        tokenIds[ticker] = tokens.token_ids[ticker]
    }
    for(const ticker in tokens.token_names){
        tokenNames[ticker] = tokens.token_names[ticker]
    }
    for(const tokenId in tokens.token_tickers){
        tokenTickers[tokenId] = tokens.token_tickers[tokenId]
    }
    events.emit("wallet_ready")
})()
