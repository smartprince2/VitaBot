// Thanks Allen for this abi
export const CONSENSUS_ABI = [
    {
        "type": "variable",
        "name": "consensusGroupInfo",
        "inputs": [
            {
                "name": "nodeCount",
                "type": "uint8"
            },
            {
                "name": "interval",
                "type": "int64"
            },
            {
                "name": "perCount",
                "type": "int64"
            },
            {
                "name": "randCount",
                "type": "uint8"
            },
            {
                "name": "randRank",
                "type": "uint8"
            },
            {
                "name": "repeat",
                "type": "uint16"
            },
            {
                "name": "checkLevel",
                "type": "uint8"
            },
            {
                "name": "countingTokenId",
                "type": "tokenId"
            },
            {
                "name": "registerConditionId",
                "type": "uint8"
            },
            {
                "name": "registerConditionParam",
                "type": "bytes"
            },
            {
                "name": "voteConditionId",
                "type": "uint8"
            },
            {
                "name": "voteConditionParam",
                "type": "bytes"
            },
            {
                "name": "owner",
                "type": "address"
            },
            {
                "name": "stakeAmount",
                "type": "uint256"
            },
            {
                "name": "expirationHeight",
                "type": "uint64"
            }
        ],
        "id": ""
    },
    {
        "type": "variable",
        "name": "registerStakeParam",
        "inputs": [
            {
                "name": "stakeAmount",
                "type": "uint256"
            },
            {
                "name": "stakeToken",
                "type": "tokenId"
            },
            {
                "name": "stakeHeight",
                "type": "uint64"
            }
        ],
        "id": ""
    },
    {
        "type": "function",
        "name": "Register",
        "inputs": [
            {
                "name": "gid",
                "type": "gid"
            },
            {
                "name": "sbpName",
                "type": "string"
            },
            {
                "name": "blockProducingAddress",
                "type": "address"
            }
        ],
        "id": "f29c6ce2"
    },
    {
        "type": "function",
        "name": "RegisterSBP",
        "inputs": [
            {
                "name": "sbpName",
                "type": "string"
            },
            {
                "name": "blockProducingAddress",
                "type": "address"
            },
            {
                "name": "rewardWithdrawAddress",
                "type": "address"
            }
        ],
        "id": "43075fbf"
    },
    {
        "type": "function",
        "name": "UpdateRegistration",
        "inputs": [
            {
                "name": "gid",
                "type": "gid"
            },
            {
                "name": "sbpName",
                "type": "string"
            },
            {
                "name": "blockProducingAddress",
                "type": "address"
            }
        ],
        "id": "3b7bdf74"
    },
    {
        "type": "function",
        "name": "UpdateBlockProducingAddress",
        "inputs": [
            {
                "name": "gid",
                "type": "gid"
            },
            {
                "name": "sbpName",
                "type": "string"
            },
            {
                "name": "blockProducingAddress",
                "type": "address"
            }
        ],
        "id": "688338e2"
    },
    {
        "type": "function",
        "name": "UpdateSBPBlockProducingAddress",
        "inputs": [
            {
                "name": "sbpName",
                "type": "string"
            },
            {
                "name": "blockProducingAddress",
                "type": "address"
            }
        ],
        "id": "1448e38e"
    },
    {
        "type": "function",
        "name": "UpdateSBPRewardWithdrawAddress",
        "inputs": [
            {
                "name": "sbpName",
                "type": "string"
            },
            {
                "name": "rewardWithdrawAddress",
                "type": "address"
            }
        ],
        "id": "863f8813"
    },
    {
        "type": "function",
        "name": "CancelRegister",
        "inputs": [
            {
                "name": "gid",
                "type": "gid"
            },
            {
                "name": "sbpName",
                "type": "string"
            }
        ],
        "id": "60862fe2"
    },
    {
        "type": "function",
        "name": "Revoke",
        "inputs": [
            {
                "name": "gid",
                "type": "gid"
            },
            {
                "name": "sbpName",
                "type": "string"
            }
        ],
        "id": "9231434a"
    },
    {
        "type": "function",
        "name": "RevokeSBP",
        "inputs": [
            {
                "name": "sbpName",
                "type": "string"
            }
        ],
        "id": "ae0167df"
    },
    {
        "type": "function",
        "name": "Reward",
        "inputs": [
            {
                "name": "gid",
                "type": "gid"
            },
            {
                "name": "sbpName",
                "type": "string"
            },
            {
                "name": "receiveAddress",
                "type": "address"
            }
        ],
        "id": "ce1f27a7"
    },
    {
        "type": "function",
        "name": "WithdrawReward",
        "inputs": [
            {
                "name": "gid",
                "type": "gid"
            },
            {
                "name": "sbpName",
                "type": "string"
            },
            {
                "name": "receiveAddress",
                "type": "address"
            }
        ],
        "id": "70c41280"
    },
    {
        "type": "function",
        "name": "WithdrawSBPReward",
        "inputs": [
            {
                "name": "sbpName",
                "type": "string"
            },
            {
                "name": "receiveAddress",
                "type": "address"
            }
        ],
        "id": "dfe845eb"
    },
    {
        "type": "variable",
        "name": "registrationInfo",
        "inputs": [
            {
                "name": "name",
                "type": "string"
            },
            {
                "name": "blockProducingAddress",
                "type": "address"
            },
            {
                "name": "stakeAddress",
                "type": "address"
            },
            {
                "name": "amount",
                "type": "uint256"
            },
            {
                "name": "expirationHeight",
                "type": "uint64"
            },
            {
                "name": "rewardTime",
                "type": "int64"
            },
            {
                "name": "revokeTime",
                "type": "int64"
            },
            {
                "name": "hisAddrList",
                "type": "address[]"
            }
        ],
        "id": ""
    },
    {
        "type": "variable",
        "name": "registrationInfoV2",
        "inputs": [
            {
                "name": "name",
                "type": "string"
            },
            {
                "name": "blockProducingAddress",
                "type": "address"
            },
            {
                "name": "rewardWithdrawAddress",
                "type": "address"
            },
            {
                "name": "stakeAddress",
                "type": "address"
            },
            {
                "name": "amount",
                "type": "uint256"
            },
            {
                "name": "expirationHeight",
                "type": "uint64"
            },
            {
                "name": "rewardTime",
                "type": "int64"
            },
            {
                "name": "revokeTime",
                "type": "int64"
            },
            {
                "name": "hisAddrList",
                "type": "address[]"
            }
        ],
        "id": ""
    },
    {
        "type": "variable",
        "name": "registeredHisName",
        "inputs": [
            {
                "name": "name",
                "type": "string"
            }
        ],
        "id": ""
    },
    {
        "type": "function",
        "name": "Vote",
        "inputs": [
            {
                "name": "gid",
                "type": "gid"
            },
            {
                "name": "sbpName",
                "type": "string"
            }
        ],
        "id": "fdc17f25"
    },
    {
        "type": "function",
        "name": "VoteForSBP",
        "inputs": [
            {
                "name": "sbpName",
                "type": "string"
            }
        ],
        "id": "42f2eee4"
    },
    {
        "type": "function",
        "name": "CancelVote",
        "inputs": [
            {
                "name": "gid",
                "type": "gid"
            }
        ],
        "id": "a629c531"
    },
    {
        "type": "function",
        "name": "CancelSBPVoting",
        "inputs": [],
        "id": "30b3f2ad"
    },
    {
        "type": "variable",
        "name": "voteInfo",
        "inputs": [
            {
                "name": "sbpName",
                "type": "string"
            }
        ],
        "id": ""
    }
]