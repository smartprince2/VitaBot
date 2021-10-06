import { tokenDecimals, tokenIds, tokenNames, tokenPromise, tokenTickers } from "../node";

export default async function getTokens(){
    await tokenPromise
    return {
        token_ids: tokenIds,
        token_names: tokenNames,
        token_tickers: tokenTickers,
        token_decimals: tokenDecimals
    }
}