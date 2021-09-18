import { tokenDecimals, tokenIds, tokenNames, tokenTickers } from "../node";

export default function getTokens(){
    return {
        token_ids: tokenIds,
        token_names: tokenNames,
        token_tickers: tokenTickers,
        token_decimals: tokenDecimals
    }
}