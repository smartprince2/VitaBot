import "../common/load-env";
import { dbPromise } from "../common/load-db";
import { init } from "./node";
import initStuckTransactionService from "./stuckTransactions";

(async () => {
    console.log("Starting Wallet !")

    // First, connect to the database and node.
    await Promise.all([
        dbPromise,
        init()
    ])

    initStuckTransactionService()

    import("./server")
})()