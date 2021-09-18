const generateError = name => {
    class whatevererror extends Error {
        name = name
    }
    return whatevererror
}

export const BalanceError = generateError("BalanceError")
export const AmountError = generateError("AmountError")